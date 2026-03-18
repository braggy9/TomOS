import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSydneyToday } from '@/lib/sydney-time'

/**
 * GET /api/cron/life-morning
 * Morning push notification with today's habits, priorities, and shopping count.
 * Runs at 6:15am Sydney via Vercel cron (19:15 UTC).
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { startOfDay, endOfDay, sydneyDate, dateStr } = getSydneyToday()
    const dayOfWeek = sydneyDate.getUTCDay()
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]

    // Calculate Monday of current week
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(sydneyDate)
    monday.setUTCDate(monday.getUTCDate() - daysFromMonday)
    monday.setUTCHours(0, 0, 0, 0)

    // Run queries in parallel
    const [habits, shoppingCount, weeklyPlan, urgentTasks] = await Promise.all([
      // Active habits due today
      prisma.habit.findMany({
        where: { status: 'active' },
        select: { id: true, title: true, icon: true, frequency: true, customDays: true },
      }),

      // Unchecked shopping items
      prisma.shoppingItem.count({
        where: { checked: false, listId: null },
      }),

      // Current week's plan
      prisma.weeklyPlan.findUnique({
        where: { weekStart: monday },
      }),

      // Urgent/high tasks due today or overdue
      prisma.task.findMany({
        where: {
          status: { in: ['todo', 'in_progress'] },
          OR: [
            { priority: { in: ['urgent', 'high'] } },
            { dueDate: { lte: endOfDay } },
          ],
        },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        take: 3,
        select: { title: true, priority: true, dueDate: true },
      }),
    ])

    // Filter habits to today's schedule
    const todaysHabits = habits.filter((habit) => {
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

    // Build notification
    const lines: string[] = []

    // Habits summary
    if (todaysHabits.length > 0) {
      const habitIcons = todaysHabits
        .map((h) => h.icon || '·')
        .join(' ')
      lines.push(`${todaysHabits.length} habits: ${habitIcons}`)
    }

    // Today's priorities from weekly plan
    const priorities = weeklyPlan?.priorities as Array<{ title: string; status: string }> | null
    if (priorities && priorities.length > 0) {
      const activePriorities = priorities.filter((p) => p.status !== 'done')
      if (activePriorities.length > 0) {
        lines.push(activePriorities.slice(0, 2).map((p) => p.title).join(', '))
      }
    }

    // Urgent tasks
    if (urgentTasks.length > 0) {
      lines.push(`⚡ ${urgentTasks.map((t) => t.title).slice(0, 2).join(', ')}`)
    }

    // Shopping
    if (shoppingCount > 0) {
      lines.push(`🛒 ${shoppingCount} items on shopping list`)
    }

    // Kid week indicator
    const kidWeekLabel = weeklyPlan?.kidWeek === true ? ' (kid week)' : weeklyPlan?.kidWeek === false ? '' : ''

    const title = `Good morning! ${dayName}${kidWeekLabel}`
    const body = lines.length > 0 ? lines.join(' | ') : 'No habits or priorities set — check the Life app'

    // Send push notification
    const pushRes = await fetch('https://tomos-task-api.vercel.app/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, badge: todaysHabits.length }),
    })

    const pushResult = await pushRes.json()

    return NextResponse.json({
      success: true,
      notification: { title, body },
      summary: {
        date: dateStr,
        habitsToday: todaysHabits.length,
        shoppingItems: shoppingCount,
        urgentTasks: urgentTasks.length,
        hasPlan: !!weeklyPlan,
      },
      pushSent: pushResult,
    })
  } catch (error) {
    console.error('Error in life morning cron:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to run life morning cron' },
      { status: 500 }
    )
  }
}

/** POST handler for manual testing */
export async function POST(request: NextRequest) {
  return GET(request)
}
