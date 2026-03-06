import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gym/coach/today
 * Today's snapshot — run, recovery, and coach prescription.
 * Coach prescriptions are the sole source of daily session guidance.
 */
export async function GET() {
  try {
    const { startOfDay, endOfDay, dateStr } = getSydneyToday()

    const [todayRun, todayRecovery, todayPrescription, todayActivities] = await Promise.all([
      prisma.runningSync.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        include: { runSession: true },
        orderBy: { date: 'desc' },
      }),
      prisma.recoveryCheckIn.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { date: 'desc' },
      }),
      prisma.coachPrescription.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        hasRun: !!todayRun,
        run: todayRun,
        recovery: todayRecovery
          ? {
              sleepQuality: todayRecovery.sleepQuality,
              energy: todayRecovery.energy,
              soreness: todayRecovery.soreness,
              motivation: todayRecovery.motivation,
              readinessScore: todayRecovery.readinessScore,
              notes: todayRecovery.notes,
            }
          : null,
        prescription: todayPrescription
          ? {
              sessionType: todayPrescription.sessionType,
              targetDistanceKm: todayPrescription.targetDistanceKm,
              targetHRZone: todayPrescription.targetHRZone,
              targetPace: todayPrescription.targetPace,
              warmup: todayPrescription.warmup,
              mainSet: todayPrescription.mainSet,
              cooldown: todayPrescription.cooldown,
              notes: todayPrescription.notes,
            }
          : null,
        activities: todayActivities.map(a => ({
          id: a.id,
          activityType: a.activityType,
          duration: a.duration,
          distance: a.distance,
          activityName: a.activityName,
          source: a.source,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching coach today:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch today snapshot' }, { status: 500 })
  }
}
