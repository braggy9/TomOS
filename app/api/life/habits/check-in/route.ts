import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/habits/check-in
 * Get today's habits with completion status (Sydney TZ)
 * Returns all active habits with whether they have a log for today
 */
export async function GET() {
  try {
    const { startOfDay, endOfDay, sydneyDate } = getSydneyToday()
    const dayOfWeek = sydneyDate.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to 1=Mon, 7=Sun for matching habit frequency
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek

    const habits = await prisma.habit.findMany({
      where: { status: 'active' },
      include: {
        logs: {
          where: {
            date: { gte: startOfDay, lte: endOfDay },
          },
        },
        goal: { select: { id: true, title: true } },
      },
      orderBy: { title: 'asc' },
    })

    // Filter to habits that are due today based on frequency
    const todaysHabits = habits.filter((habit) => {
      switch (habit.frequency) {
        case 'daily':
          return true
        case 'weekdays':
          return isoDayOfWeek >= 1 && isoDayOfWeek <= 5
        case 'weekends':
          return isoDayOfWeek >= 6
        case 'mon_wed_fri':
          return [1, 3, 5].includes(isoDayOfWeek)
        case 'tue_thu':
          return [2, 4].includes(isoDayOfWeek)
        case 'custom':
          return habit.customDays.includes(isoDayOfWeek)
        default:
          return true
      }
    })

    const checkIn = todaysHabits.map((habit) => ({
      habit: {
        id: habit.id,
        title: habit.title,
        icon: habit.icon,
        category: habit.category,
        frequency: habit.frequency,
        goalId: habit.goalId,
        goal: habit.goal,
      },
      completedToday: habit.logs.some((l) => l.completed),
      streak: habit.streakCurrent,
    }))

    return NextResponse.json({ success: true, data: checkIn })
  } catch (error) {
    console.error('Error fetching habit check-in:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch check-in' }, { status: 500 })
  }
}

/**
 * POST /api/life/habits/check-in
 * Batch log today's habits
 * Body: { habits: [{ id: string, completed: boolean }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { habits } = body

    if (!habits || !Array.isArray(habits)) {
      return NextResponse.json(
        { success: false, error: 'habits array is required' },
        { status: 400 }
      )
    }

    const { startOfDay } = getSydneyToday()

    const results = await prisma.$transaction(
      habits.map((h: { id: string; completed: boolean; notes?: string }) =>
        prisma.habitLog.upsert({
          where: {
            habitId_date: { habitId: h.id, date: startOfDay },
          },
          create: {
            habitId: h.id,
            date: startOfDay,
            completed: h.completed,
            notes: h.notes || null,
          },
          update: {
            completed: h.completed,
            notes: h.notes !== undefined ? h.notes : undefined,
          },
        })
      )
    )

    // Fire-and-forget: update streaks for all logged habits
    Promise.all(
      habits.map((h: { id: string }) => updateStreakQuick(h.id))
    ).catch((err) => console.error('Batch streak update error:', err))

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Error batch logging habits:', error)
    return NextResponse.json({ success: false, error: 'Failed to batch log habits' }, { status: 500 })
  }
}

async function updateStreakQuick(habitId: string) {
  const logs = await prisma.habitLog.findMany({
    where: { habitId, completed: true },
    orderBy: { date: 'desc' },
    take: 365,
  })

  let streak = 0
  if (logs.length > 0) {
    streak = 1
    for (let i = 1; i < logs.length; i++) {
      const diffDays = Math.round(
        (logs[i - 1].date.getTime() - logs[i].date.getTime()) / (24 * 60 * 60 * 1000)
      )
      if (diffDays <= 1) streak++
      else break
    }
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId } })
  await prisma.habit.update({
    where: { id: habitId },
    data: {
      streakCurrent: streak,
      streakBest: Math.max(streak, habit?.streakBest || 0),
    },
  })
}
