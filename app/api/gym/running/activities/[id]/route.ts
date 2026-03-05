import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calculateZones, calculateZoneTime } from '@/lib/fitness/hr-zones'

/**
 * GET /api/gym/running/activities/[id]
 * Single activity detail with splits, HR zones, and run session
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const activity = await prisma.runningSync.findUnique({
      where: { id },
      include: { runSession: true },
    })

    if (!activity) {
      return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 })
    }

    // Calculate HR zones if we have HR data
    let hrZones = null
    let zoneTime = null

    const settings = await prisma.userSettings.findUnique({ where: { id: 'singleton' } })
    const maxHR = settings?.maxHeartRate || 192

    hrZones = calculateZones(maxHR)

    if (activity.splits && Array.isArray(activity.splits)) {
      zoneTime = calculateZoneTime(activity.splits as Array<{ avgHR?: number | null; timeSec: number }>, maxHR)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...activity,
        hrZones,
        zoneTime,
      },
    })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activity' }, { status: 500 })
  }
}
