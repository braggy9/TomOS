import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getRunningLoadContext } from '@/lib/fitness/running-load'

/**
 * GET /api/gym/coach/summary
 * Weekly overview for the running coach — aggregated training, recovery, and load data.
 */
export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [runs, gymSessions, recoveryCheckins, loadContext, settings, activities] = await Promise.all([
      prisma.runningSync.findMany({
        where: { date: { gte: since } },
        include: { runSession: true },
        orderBy: { date: 'desc' },
      }),
      prisma.gymSession.findMany({
        where: { date: { gte: since } },
      }),
      prisma.recoveryCheckIn.findMany({
        where: { date: { gte: since } },
        orderBy: { date: 'desc' },
      }),
      getRunningLoadContext(),
      prisma.userSettings.findUnique({ where: { id: 'singleton' } }),
      prisma.activity.findMany({
        where: { date: { gte: since } },
        orderBy: { date: 'desc' },
      }),
    ])

    // Running stats
    const totalKm = runs.reduce((sum, r) => sum + r.distance, 0)
    const totalDuration = runs.reduce((sum, r) => sum + r.duration, 0)
    const avgPace = totalKm > 0 ? totalDuration / totalKm : 0
    const avgHRValues = runs.map(r => r.avgHeartRate).filter((hr): hr is number => hr !== null)
    const avgHR = avgHRValues.length > 0
      ? Math.round(avgHRValues.reduce((s, hr) => s + hr, 0) / avgHRValues.length)
      : null

    const longestRun = runs.length > 0
      ? runs.reduce((max, r) => r.distance > max.distance ? r : max, runs[0])
      : null

    // Group runs by type
    const byType: Record<string, number> = {}
    for (const r of runs) {
      const type = r.runSession?.sessionTypeOverride || r.type
      byType[type] = (byType[type] || 0) + 1
    }

    // Gym stats
    const rpes = gymSessions.map(s => s.overallRPE).filter((r): r is number => r !== null)
    const avgRPE = rpes.length > 0
      ? Math.round((rpes.reduce((s, r) => s + r, 0) / rpes.length) * 10) / 10
      : null

    // Recovery stats
    const readinessScores = recoveryCheckins
      .map(c => c.readinessScore)
      .filter((r): r is number => r !== null)
    const avgReadiness = readinessScores.length > 0
      ? Math.round((readinessScores.reduce((s, r) => s + r, 0) / readinessScores.length) * 10) / 10
      : null

    const latestCheckin = recoveryCheckins[0] || null

    // Activities stats
    const activityByType: Record<string, number> = {}
    let activityTotalDuration = 0
    const activityRpes = activities.map(a => a.rpe).filter((r): r is number => r !== null)
    for (const a of activities) {
      activityByType[a.activityType] = (activityByType[a.activityType] || 0) + 1
      activityTotalDuration += a.duration
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          days,
          start: since.toISOString(),
          end: new Date().toISOString(),
        },
        running: {
          totalKm: Math.round(totalKm * 10) / 10,
          sessions: runs.length,
          avgPace: Math.round(avgPace * 100) / 100,
          avgHR,
          longestRun: longestRun
            ? { distance: Math.round(longestRun.distance * 10) / 10, date: longestRun.date, type: longestRun.type }
            : null,
          byType,
        },
        gym: {
          sessions: gymSessions.length,
          avgRPE,
        },
        activities: {
          sessions: activities.length,
          totalDuration: activityTotalDuration,
          byType: activityByType,
          avgRPE: activityRpes.length > 0
            ? Math.round((activityRpes.reduce((s, r) => s + r, 0) / activityRpes.length) * 10) / 10
            : null,
        },
        recovery: {
          avgReadiness,
          latestCheckin: latestCheckin
            ? {
                date: latestCheckin.date,
                sleepQuality: latestCheckin.sleepQuality,
                energy: latestCheckin.energy,
                soreness: latestCheckin.soreness,
                readinessScore: latestCheckin.readinessScore,
              }
            : null,
          checkins: recoveryCheckins.length,
        },
        load: {
          acwr: loadContext.acwr,
          acuteLoad: loadContext.acuteLoad,
          chronicLoad: loadContext.chronicLoad,
          trend: loadContext.trend,
          loadFactor: loadContext.loadFactor,
          recommendation: loadContext.recommendation,
        },
        settings: {
          maxHeartRate: settings?.maxHeartRate || 192,
          weekType: settings?.defaultWeekType || 'non-kid',
        },
      },
    })
  } catch (error) {
    console.error('Error fetching coach summary:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch coach summary' }, { status: 500 })
  }
}
