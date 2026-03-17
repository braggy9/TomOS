import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

/**
 * POST /api/life/habits/[id]/log
 * Log completion for a specific date (defaults to today Sydney TZ)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: habitId } = await params
    const body = await request.json()
    const { date, completed, notes } = body

    // Default to today in Sydney
    let logDate: Date
    if (date) {
      logDate = new Date(date)
    } else {
      const { startOfDay } = getSydneyToday()
      logDate = startOfDay
    }

    // Upsert — allow toggling completion
    const log = await prisma.habitLog.upsert({
      where: {
        habitId_date: { habitId, date: logDate },
      },
      create: {
        habitId,
        date: logDate,
        completed: completed !== undefined ? completed : true,
        notes: notes || null,
      },
      update: {
        completed: completed !== undefined ? completed : true,
        notes: notes !== undefined ? notes : undefined,
      },
    })

    // Fire-and-forget: update streak
    updateStreak(habitId).catch((err) =>
      console.error('Streak update error:', err)
    )

    return NextResponse.json({ success: true, data: log }, { status: 201 })
  } catch (error) {
    console.error('Error logging habit:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log habit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate and update streak for a habit.
 * Counts consecutive completed days backwards from today.
 */
async function updateStreak(habitId: string) {
  const logs = await prisma.habitLog.findMany({
    where: { habitId, completed: true },
    orderBy: { date: 'desc' },
    take: 365,
  })

  if (logs.length === 0) {
    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCurrent: 0 },
    })
    return
  }

  // Count consecutive days from most recent log
  let streak = 1
  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1].date.getTime()
    const curr = logs[i].date.getTime()
    const diffDays = Math.round((prev - curr) / (24 * 60 * 60 * 1000))
    if (diffDays <= 1) {
      streak++
    } else {
      break
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
