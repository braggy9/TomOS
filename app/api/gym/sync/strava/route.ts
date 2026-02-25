import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calculateTrainingLoad, classifyRunType, calculatePace } from '@/lib/fitness/running-load'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'

/**
 * GET /api/gym/sync/strava
 * Strava webhook verification (subscription challenge)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')

  if (mode === 'subscribe' && challenge) {
    // Verify the token matches our expected value
    const expectedToken = process.env.STRAVA_VERIFY_TOKEN
    if (!expectedToken) {
      console.error('STRAVA_VERIFY_TOKEN is not configured — rejecting webhook verification')
      return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 })
    }
    if (verifyToken !== expectedToken) {
      return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 })
    }

    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

/**
 * POST /api/gym/sync/strava
 * Strava webhook handler — receives activity events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Strava sends a challenge on subscription setup
    if (body['hub.challenge']) {
      return NextResponse.json({ 'hub.challenge': body['hub.challenge'] })
    }

    // Only process new running activities
    if (body.object_type !== 'activity' || body.aspect_type !== 'create') {
      return NextResponse.json({ received: true })
    }

    const activityId = body.object_id

    // Get token from DB (auto-refreshes if expired)
    const accessToken = await getStravaAccessToken()
    if (!accessToken) {
      console.error('No Strava token available — authorize via /api/gym/sync/strava/auth')
      return NextResponse.json({ received: true, warning: 'Strava not authorized' })
    }

    const activityRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!activityRes.ok) {
      console.error('Failed to fetch Strava activity:', activityRes.status)
      return NextResponse.json({ received: true, warning: 'Failed to fetch activity' })
    }

    const activity = await activityRes.json()

    // Only sync running activities
    if (activity.type !== 'Run' && activity.type !== 'TrailRun') {
      return NextResponse.json({ received: true, skipped: 'Not a run' })
    }

    // Upsert into running_sync
    const runningSync = await prisma.runningSync.upsert({
      where: { externalId: String(activityId) },
      create: {
        externalId: String(activityId),
        source: 'strava',
        date: new Date(activity.start_date),
        type: classifyRunType(activity),
        distance: activity.distance / 1000,
        duration: Math.round(activity.moving_time / 60),
        avgPace: calculatePace(activity),
        avgHeartRate: activity.average_heartrate || null,
        elevationGain: activity.total_elevation_gain || null,
        trainingLoad: calculateTrainingLoad(activity),
      },
      update: {
        date: new Date(activity.start_date),
        type: classifyRunType(activity),
        distance: activity.distance / 1000,
        duration: Math.round(activity.moving_time / 60),
        avgPace: calculatePace(activity),
        avgHeartRate: activity.average_heartrate || null,
        elevationGain: activity.total_elevation_gain || null,
        trainingLoad: calculateTrainingLoad(activity),
      },
    })

    return NextResponse.json({ received: true, synced: runningSync.id })
  } catch (error) {
    console.error('Error processing Strava webhook:', error)
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}
