import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'

/**
 * GET /api/gym/running/activities/[id]/streams
 * On-demand Strava streams fetch with 24h cache
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const activity = await prisma.runningSync.findUnique({
      where: { id },
    })

    if (!activity) {
      return NextResponse.json({ success: false, error: 'Activity not found' }, { status: 404 })
    }

    // Check cache (24h)
    if (activity.streamsCache && activity.streamsCachedAt) {
      const cacheAge = Date.now() - new Date(activity.streamsCachedAt).getTime()
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ success: true, data: activity.streamsCache, cached: true })
      }
    }

    // Fetch from Strava
    const accessToken = await getStravaAccessToken()
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Strava not authorized. Re-auth via /api/gym/sync/strava/auth' },
        { status: 401 }
      )
    }

    const streamsRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activity.externalId}/streams?keys=heartrate,distance,latlng,altitude,cadence&key_type=distance`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!streamsRes.ok) {
      const errorText = await streamsRes.text()
      console.error('Strava streams fetch failed:', streamsRes.status, errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch streams from Strava' },
        { status: 502 }
      )
    }

    const streams = await streamsRes.json()

    // Cache the streams
    await prisma.runningSync.update({
      where: { id },
      data: {
        streamsCache: streams,
        streamsCachedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: streams, cached: false })
  } catch (error) {
    console.error('Error fetching activity streams:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch streams' }, { status: 500 })
  }
}
