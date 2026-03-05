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

    // Parse splits from Strava splits_metric
    const splits = activity.splits_metric?.map((s: any, i: number) => ({
      km: i + 1,
      timeSec: s.elapsed_time || s.moving_time || 0,
      avgHR: s.average_heartrate || null,
      avgPace: s.moving_time && s.distance ? Math.round((s.moving_time / 60) / (s.distance / 1000) * 100) / 100 : null,
      elevation: s.elevation_difference || 0,
    })) || null

    // Upsert into running_sync with extended fields
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
        maxHeartRate: activity.max_heartrate || null,
        avgCadence: activity.average_cadence ? activity.average_cadence * 2 : null,
        calories: activity.calories || null,
        activityName: activity.name || null,
        description: activity.description || null,
        sufferScore: activity.suffer_score || null,
        splits: splits,
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
        maxHeartRate: activity.max_heartrate || null,
        avgCadence: activity.average_cadence ? activity.average_cadence * 2 : null,
        calories: activity.calories || null,
        activityName: activity.name || null,
        description: activity.description || null,
        sufferScore: activity.suffer_score || null,
        splits: splits,
      },
    })

    // Auto-reconcile: try to match this run to a planned session
    const activityDate = new Date(activity.start_date)
    const activityDayOfWeek = activityDate.getDay() === 0 ? 7 : activityDate.getDay()

    const planned = await prisma.plannedSession.findFirst({
      where: {
        status: 'planned',
        linkedRunId: null,
        dayOfWeek: activityDayOfWeek,
        week: {
          startDate: { lte: activityDate },
          block: { status: 'active' },
        },
      },
      orderBy: { week: { startDate: 'desc' } },
    })

    if (planned) {
      await prisma.plannedSession.update({
        where: { id: planned.id },
        data: {
          linkedRunId: runningSync.id,
          status: 'completed',
        },
      })
    }

    return NextResponse.json({
      received: true,
      synced: runningSync.id,
      matchedPlannedSession: planned?.id ?? null,
    })
  } catch (error) {
    console.error('Error processing Strava webhook:', error)
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}
