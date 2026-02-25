import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/gym/progress/summary
 * Total sessions, weekly rate, streaks, PRs
 */
export async function GET() {
  try {
    const now = new Date()
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(now.getDate() - 90)

    // Start of current week (Monday)
    const weekStart = new Date(now)
    const day = weekStart.getDay()
    const diff = day === 0 ? 6 : day - 1
    weekStart.setDate(weekStart.getDate() - diff)
    weekStart.setHours(0, 0, 0, 0)

    // Start of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totalSessions, recentSessions, sessionsThisWeek, sessionsThisMonth] = await Promise.all([
      prisma.gymSession.count(),
      prisma.gymSession.findMany({
        where: { date: { gte: ninetyDaysAgo } },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      prisma.gymSession.count({ where: { date: { gte: weekStart } } }),
      prisma.gymSession.count({ where: { date: { gte: monthStart } } }),
    ])

    // Weekly rate over last 90 days
    const weeksInPeriod = 90 / 7
    const weeklyRate = Math.round((recentSessions.length / weeksInPeriod) * 10) / 10

    // Calculate streak (consecutive weeks with at least 1 session)
    let currentStreak = 0
    const checkWeek = new Date(weekStart)
    for (let i = 0; i < 52; i++) {
      const wkEnd = new Date(checkWeek)
      wkEnd.setDate(wkEnd.getDate() + 7)
      const hasSession = recentSessions.some(
        s => s.date >= checkWeek && s.date < wkEnd
      )
      if (hasSession) {
        currentStreak++
        checkWeek.setDate(checkWeek.getDate() - 7)
      } else {
        break
      }
    }

    // Personal records: top weight per exercise
    const topSets = await prisma.exerciseSet.findMany({
      where: { weight: { not: null } },
      orderBy: { weight: 'desc' },
      include: {
        sessionExercise: {
          include: {
            exercise: { select: { name: true } },
            session: { select: { date: true } },
          },
        },
      },
      take: 100,
    })

    const prMap = new Map<string, { exerciseName: string; weight: number; date: string }>()
    for (const set of topSets) {
      const name = set.sessionExercise.exercise.name
      if (!prMap.has(name)) {
        prMap.set(name, {
          exerciseName: name,
          weight: set.weight!,
          date: set.sessionExercise.session.date.toISOString().split('T')[0],
        })
      }
    }
    const personalRecords = Array.from(prMap.values()).slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        totalSessions,
        weeklyRate,
        currentStreak,
        personalRecords,
        sessionsThisWeek,
        sessionsThisMonth,
      },
    })
  } catch (error) {
    console.error('Error fetching progress summary:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch summary' }, { status: 500 })
  }
}
