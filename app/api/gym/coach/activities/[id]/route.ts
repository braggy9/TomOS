import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calculateZones, calculateZoneTime } from '@/lib/fitness/hr-zones'

/**
 * GET /api/gym/coach/activities/[id]
 * Full activity detail with HR zone distribution for the coach.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [activity, settings] = await Promise.all([
      prisma.runningSync.findUnique({
        where: { id },
        include: { runSession: true },
      }),
      prisma.userSettings.findUnique({ where: { id: 'singleton' } }),
    ])

    if (!activity) {
      return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 })
    }

    const maxHR = settings?.maxHeartRate || 192
    const hrZones = calculateZones(maxHR)

    let zoneTime = null
    if (activity.splits && Array.isArray(activity.splits)) {
      zoneTime = calculateZoneTime(
        activity.splits as Array<{ avgHR?: number | null; timeSec: number }>,
        maxHR
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: activity.id,
        date: activity.date,
        type: activity.runSession?.sessionTypeOverride || activity.type,
        activityName: activity.activityName,
        distance: Math.round(activity.distance * 10) / 10,
        duration: activity.duration,
        avgPace: activity.avgPace ? Math.round(activity.avgPace * 100) / 100 : null,
        avgHeartRate: activity.avgHeartRate,
        maxHeartRate: activity.maxHeartRate,
        elevationGain: activity.elevationGain,
        trainingLoad: activity.trainingLoad,
        splits: activity.splits,
        sufferScore: activity.sufferScore,
        avgCadence: activity.avgCadence,
        calories: activity.calories,
        runSession: activity.runSession
          ? {
              rpe: activity.runSession.rpe,
              moodPost: activity.runSession.moodPost,
              sessionTypeOverride: activity.runSession.sessionTypeOverride,
              notes: activity.runSession.notes,
            }
          : null,
        hrZones,
        zoneTime,
      },
    })
  } catch (error) {
    console.error('Error fetching coach activity detail:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activity' }, { status: 500 })
  }
}
