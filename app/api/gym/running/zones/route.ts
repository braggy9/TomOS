import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calculateZones, calculateZoneTime } from '@/lib/fitness/hr-zones'

/**
 * GET /api/gym/running/zones
 * Calculate HR zones from UserSettings.maxHeartRate
 * Optional ?activityId= for zone time distribution
 */
export async function GET(request: NextRequest) {
  try {
    const activityId = request.nextUrl.searchParams.get('activityId')

    const settings = await prisma.userSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })

    const zones = calculateZones(settings.maxHeartRate)

    let zoneTime = null
    if (activityId) {
      const activity = await prisma.runningSync.findUnique({
        where: { id: activityId },
      })

      if (activity?.splits && Array.isArray(activity.splits)) {
        zoneTime = calculateZoneTime(
          activity.splits as Array<{ avgHR?: number | null; timeSec: number }>,
          settings.maxHeartRate
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        maxHeartRate: settings.maxHeartRate,
        restingHR: settings.restingHR,
        zones,
        zoneTime,
      },
    })
  } catch (error) {
    console.error('Error calculating zones:', error)
    return NextResponse.json({ success: false, error: 'Failed to calculate zones' }, { status: 500 })
  }
}
