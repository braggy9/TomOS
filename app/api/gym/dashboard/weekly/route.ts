import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getACWR } from '@/lib/fitness/running-load'
import { getSydneyToday } from '@/lib/sydney-time'

/**
 * GET /api/gym/dashboard/weekly
 * Aggregated weekly data for the dashboard
 */
export async function GET() {
  try {
    const { startOfDay, sydneyDate } = getSydneyToday()

    // Get Monday of current week (in Sydney time)
    const jsDay = sydneyDate.getUTCDay()
    const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1

    // Monday 00:00:00 Sydney = today's startOfDay minus daysSinceMonday days
    const monday = new Date(startOfDay.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000)
    // Sunday 23:59:59.999 Sydney = Monday + 7 days - 1ms
    const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)

    // Parallel queries
    const [runs, gymSessions, recoveryCheckins, { acwr }] = await Promise.all([
      prisma.runningSync.findMany({
        where: { date: { gte: monday, lte: sunday } },
        orderBy: { date: 'asc' },
      }),
      prisma.gymSession.findMany({
        where: { date: { gte: monday, lte: sunday } },
        include: {
          sessionExercises: { include: { sets: true } },
        },
      }),
      prisma.recoveryCheckIn.findMany({
        where: { date: { gte: monday, lte: sunday } },
        orderBy: { date: 'asc' },
      }),
      getACWR(),
    ])

    // Running stats
    const totalKm = runs.reduce((sum, r) => sum + r.distance, 0)
    const totalDuration = runs.reduce((sum, r) => sum + r.duration, 0)
    const avgPace = totalKm > 0 ? totalDuration / totalKm : 0
    const longestRun = runs.reduce((max, r) => r.distance > max ? r.distance : max, 0)

    // Gym stats
    const totalSets = gymSessions.reduce(
      (sum, s) => sum + s.sessionExercises.reduce((es, se) => es + se.sets.length, 0),
      0
    )
    const rpes = gymSessions.map(s => s.overallRPE).filter((r): r is number => r !== null)
    const avgRPE = rpes.length > 0 ? Math.round((rpes.reduce((s, r) => s + r, 0) / rpes.length) * 10) / 10 : null

    // Recovery trend
    const readinessScores = recoveryCheckins
      .map(c => c.readinessScore)
      .filter((r): r is number => r !== null)
    const avgReadiness = readinessScores.length > 0
      ? Math.round((readinessScores.reduce((s, r) => s + r, 0) / readinessScores.length) * 10) / 10
      : null

    // ACWR color
    let acwrStatus: 'green' | 'amber' | 'red' = 'green'
    if (acwr > 1.5 || acwr < 0.5) acwrStatus = 'red'
    else if (acwr > 1.3 || acwr < 0.8) acwrStatus = 'amber'

    // Daily loads for bar chart (Mon-Sun)
    const dailyLoads = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      const dayStr = day.toISOString().slice(0, 10)

      const dayRuns = runs.filter(r => r.date.toISOString().slice(0, 10) === dayStr)
      const dayGym = gymSessions.filter(s => s.date.toISOString().slice(0, 10) === dayStr)

      return {
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        date: dayStr,
        runningLoad: dayRuns.reduce((sum, r) => sum + (r.trainingLoad || 0), 0),
        gymSessions: dayGym.length,
        hasActivity: dayRuns.length > 0 || dayGym.length > 0,
      }
    })

    // Plan compliance (check for active training week)
    let planCompliance = null
    const activeWeek = await prisma.trainingWeek.findFirst({
      where: {
        startDate: { lte: sunday },
        status: { in: ['active', 'planned'] },
        block: { status: 'active' },
      },
      include: {
        sessions: true,
      },
      orderBy: { startDate: 'desc' },
    })

    if (activeWeek) {
      const planned = activeWeek.sessions.length
      const completed = activeWeek.sessions.filter(s => s.status === 'completed').length
      planCompliance = { planned, completed, percentage: planned > 0 ? Math.round((completed / planned) * 100) : 0 }
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: monday.toISOString(),
          end: sunday.toISOString(),
        },
        running: {
          totalKm: Math.round(totalKm * 10) / 10,
          sessions: runs.length,
          avgPace: Math.round(avgPace * 100) / 100,
          longestRun: Math.round(longestRun * 10) / 10,
          totalDuration,
        },
        gym: {
          sessions: gymSessions.length,
          avgRPE,
          totalSets,
        },
        trainingLoad: {
          acwr,
          acwrStatus,
          dailyLoads,
        },
        recovery: {
          avgReadiness,
          checkins: recoveryCheckins.length,
        },
        planCompliance,
      },
    })
  } catch (error) {
    console.error('Error fetching weekly dashboard:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}
