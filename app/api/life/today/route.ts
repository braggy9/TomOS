import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/today
 * Aggregated dashboard snapshot — pulls from across TomOS modules.
 * Single call for "what's my day look like?"
 *
 * Returns:
 * - Active habits + today's completion
 * - Unchecked shopping items count
 * - Current week's priorities
 * - Top 5 open tasks by priority/due
 * - Last journal mood/energy
 * - Today's coach prescription (if any)
 */
export async function GET() {
  try {
    const { startOfDay, endOfDay, sydneyDate, dateStr } = getSydneyToday()
    const dayOfWeek = sydneyDate.getUTCDay()
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek

    // Calculate Monday of current week
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(sydneyDate)
    monday.setUTCDate(monday.getUTCDate() - daysFromMonday)
    monday.setUTCHours(0, 0, 0, 0)

    // Run all queries in parallel
    const [
      habits,
      shoppingCount,
      weeklyPlan,
      tasks,
      lastJournalEntry,
      coachPrescription,
    ] = await Promise.all([
      // 1. Active habits + today's logs
      prisma.habit.findMany({
        where: { status: 'active' },
        include: {
          logs: {
            where: { date: { gte: startOfDay, lte: endOfDay } },
          },
        },
        orderBy: { title: 'asc' },
      }),

      // 2. Unchecked shopping items count
      prisma.shoppingItem.count({
        where: { checked: false, listId: null },
      }),

      // 3. Current week's plan
      prisma.weeklyPlan.findUnique({
        where: { weekStart: monday },
      }),

      // 4. Top 5 open tasks by priority/due
      prisma.task.findMany({
        where: {
          status: { in: ['todo', 'in_progress'] },
        },
        orderBy: [
          { priority: 'asc' }, // urgent first (alphabetical: high, low, medium, urgent)
          { dueDate: 'asc' },
        ],
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      }),

      // 5. Last journal entry mood/energy
      prisma.journalEntry.findFirst({
        orderBy: { entryDate: 'desc' },
        select: {
          id: true,
          mood: true,
          energy: true,
          entryDate: true,
          title: true,
        },
      }),

      // 6. Today's coach prescription
      prisma.coachPrescription.findFirst({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Filter habits to today's schedule and map completion
    const todaysHabits = habits
      .filter((habit) => {
        switch (habit.frequency) {
          case 'daily': return true
          case 'weekdays': return isoDayOfWeek >= 1 && isoDayOfWeek <= 5
          case 'weekends': return isoDayOfWeek >= 6
          case 'mon_wed_fri': return [1, 3, 5].includes(isoDayOfWeek)
          case 'tue_thu': return [2, 4].includes(isoDayOfWeek)
          case 'custom': return habit.customDays.includes(isoDayOfWeek)
          default: return true
        }
      })
      .map((habit) => ({
        id: habit.id,
        title: habit.title,
        icon: habit.icon,
        completedToday: habit.logs.some((l) => l.completed),
        streak: habit.streakCurrent,
      }))

    // Sort tasks with proper priority ordering
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    const sortedTasks = tasks.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2
      const pb = priorityOrder[b.priority] ?? 2
      if (pa !== pb) return pa - pb
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        habits: {
          items: todaysHabits,
          completed: todaysHabits.filter((h) => h.completedToday).length,
          total: todaysHabits.length,
        },
        shopping: {
          uncheckedCount: shoppingCount,
        },
        plan: weeklyPlan
          ? {
              id: weeklyPlan.id,
              energyLevel: weeklyPlan.energyLevel,
              kidWeek: weeklyPlan.kidWeek,
              priorities: weeklyPlan.priorities,
              status: weeklyPlan.status,
            }
          : null,
        tasks: sortedTasks,
        journal: lastJournalEntry
          ? {
              mood: lastJournalEntry.mood,
              energy: lastJournalEntry.energy,
              entryDate: lastJournalEntry.entryDate,
              title: lastJournalEntry.title,
            }
          : null,
        training: coachPrescription
          ? {
              sessionType: coachPrescription.sessionType,
              targetDistanceKm: coachPrescription.targetDistanceKm,
              notes: coachPrescription.notes,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching today snapshot:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch today snapshot' }, { status: 500 })
  }
}
