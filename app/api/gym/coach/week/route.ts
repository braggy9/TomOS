import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

/**
 * GET /api/gym/coach/week
 * Returns a week of data for the training calendar:
 * - Coach prescriptions for each day
 * - Completed runs (from RunningSync)
 * - Completed gym sessions
 *
 * Query: ?weekOffset=0 (0 = current week, -1 = last week, 1 = next week)
 */
export async function GET(request: NextRequest) {
  try {
    const weekOffset = parseInt(request.nextUrl.searchParams.get('weekOffset') || '0')
    const { startOfDay, sydneyDate } = getSydneyToday()

    // Compute Monday of the target week
    const jsDay = sydneyDate.getUTCDay()
    const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1
    const mondayMs = startOfDay.getTime() - daysSinceMonday * 86400000 + weekOffset * 7 * 86400000
    const monday = new Date(mondayMs)
    const sunday = new Date(mondayMs + 7 * 86400000 - 1)

    const [prescriptions, runs, gymSessions] = await Promise.all([
      prisma.coachPrescription.findMany({
        where: { date: { gte: monday, lte: sunday } },
        orderBy: { date: 'asc' },
      }),
      prisma.runningSync.findMany({
        where: { date: { gte: monday, lte: sunday } },
        include: { runSession: { select: { rpe: true, moodPost: true, sessionTypeOverride: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.gymSession.findMany({
        where: { date: { gte: monday, lte: sunday } },
        select: { id: true, sessionType: true, date: true, overallRPE: true },
        orderBy: { date: 'asc' },
      }),
    ])

    // Build per-day data (Mon=0 through Sun=6)
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(mondayMs + i * 86400000)
      const dayEnd = new Date(mondayMs + (i + 1) * 86400000 - 1)

      const dayPrescriptions = prescriptions.filter(
        p => p.date >= dayStart && p.date <= dayEnd
      )
      const dayRuns = runs.filter(
        r => r.date >= dayStart && r.date <= dayEnd
      )
      const dayGym = gymSessions.filter(
        g => g.date >= dayStart && g.date <= dayEnd
      )

      return {
        dayOfWeek: i + 1, // 1=Mon, 7=Sun
        date: new Date(mondayMs + i * 86400000 + 12 * 3600000).toISOString().slice(0, 10), // noon UTC for safe date string
        prescription: dayPrescriptions[0] ? {
          sessionType: dayPrescriptions[0].sessionType,
          targetDistanceKm: dayPrescriptions[0].targetDistanceKm,
          targetHRZone: dayPrescriptions[0].targetHRZone,
          targetPace: dayPrescriptions[0].targetPace,
          warmup: dayPrescriptions[0].warmup,
          mainSet: dayPrescriptions[0].mainSet,
          cooldown: dayPrescriptions[0].cooldown,
          notes: dayPrescriptions[0].notes,
        } : null,
        completedRuns: dayRuns.map(r => ({
          id: r.id,
          distance: r.distance,
          duration: r.duration,
          avgPace: r.avgPace,
          avgHeartRate: r.avgHeartRate,
          type: r.runSession?.sessionTypeOverride || r.type,
          activityName: r.activityName,
        })),
        completedGym: dayGym.map(g => ({
          id: g.id,
          sessionType: g.sessionType,
          rpe: g.overallRPE,
        })),
      }
    })

    // Compute the Sydney date string for Monday
    const mondayDateStr = new Date(mondayMs + 12 * 3600000).toISOString().slice(0, 10)
    const sundayDateStr = new Date(mondayMs + 6 * 86400000 + 12 * 3600000).toISOString().slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        weekOffset,
        monday: mondayDateStr,
        sunday: sundayDateStr,
        days,
      },
    })
  } catch (error) {
    console.error('Error fetching coach week:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch week data' }, { status: 500 })
  }
}
