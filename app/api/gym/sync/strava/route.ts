import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calculateTrainingLoad, classifyRunType, calculatePace } from '@/lib/fitness/running-load'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import {
  recordIntegrationSyncAttempt,
  recordIntegrationSyncFailure,
  recordIntegrationSyncSuccess,
  STRAVA_SYNC_PROVIDER,
} from '@/lib/fitness/integration-sync-status'

const stravaWebhookEventSchema = z.object({
  object_type: z.string(),
  aspect_type: z.string(),
  object_id: z.number().int().positive(),
})

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

    const event = stravaWebhookEventSchema.safeParse(body)
    if (!event.success) {
      return NextResponse.json({ received: false, error: 'Invalid webhook payload' }, { status: 400 })
    }

    // Only process newly created activities.
    if (event.data.object_type !== 'activity' || event.data.aspect_type !== 'create') {
      return NextResponse.json({ received: true })
    }

    waitUntil(processStravaActivity(event.data.object_id))
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error accepting Strava webhook:', error)
    return NextResponse.json({ received: false, error: 'Invalid webhook payload' }, { status: 400 })
  }
}

async function processStravaActivity(activityId: number) {
  const trigger = 'webhook'
  await recordIntegrationSyncAttempt(STRAVA_SYNC_PROVIDER, {
    trigger,
    status: 'started',
    activityId,
  })

  try {
    // Get token from DB (auto-refreshes if expired)
    const accessToken = await getStravaAccessToken()
    if (!accessToken) {
      console.error('No Strava token available — authorize via /api/gym/sync/strava/auth')
      await recordIntegrationSyncFailure(STRAVA_SYNC_PROVIDER, 'Strava not authorized', {
        trigger,
        status: 'failed',
        activityId,
      })
      return
    }

    const activityRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!activityRes.ok) {
      console.error('Failed to fetch Strava activity:', activityRes.status)
      await recordIntegrationSyncFailure(
        STRAVA_SYNC_PROVIDER,
        `Strava activity fetch returned ${activityRes.status}`,
        { trigger, status: 'failed', activityId, httpStatus: activityRes.status }
      )
      return
    }

    const activity = await activityRes.json()

    // Route non-run activities to Activity table
    const NON_RUN_TYPES = ['Swim', 'Workout', 'Yoga', 'Walk', 'Hike', 'Ride', 'WeightTraining', 'Crossfit']
    if (activity.type !== 'Run' && activity.type !== 'TrailRun') {
      if (NON_RUN_TYPES.includes(activity.type)) {
        const typeMap: Record<string, string> = {
          Swim: 'swim', Workout: 'workout', Yoga: 'yoga', Walk: 'walk',
          Hike: 'walk', Ride: 'cross-train', WeightTraining: 'workout', Crossfit: 'workout',
        }
        await prisma.activity.upsert({
          where: { externalId: String(activityId) },
          create: {
            externalId: String(activityId),
            source: 'strava',
            date: new Date(activity.start_date),
            activityType: typeMap[activity.type] || 'other',
            duration: Math.round(activity.moving_time / 60),
            distance: activity.distance ? activity.distance / 1000 : null,
            avgHeartRate: activity.average_heartrate || null,
            calories: activity.calories || null,
            activityName: activity.name || null,
          },
          update: {
            date: new Date(activity.start_date),
            activityType: typeMap[activity.type] || 'other',
            duration: Math.round(activity.moving_time / 60),
            distance: activity.distance ? activity.distance / 1000 : null,
            avgHeartRate: activity.average_heartrate || null,
            calories: activity.calories || null,
            activityName: activity.name || null,
          },
        })
        await recordIntegrationSyncSuccess(STRAVA_SYNC_PROVIDER, {
          trigger,
          status: 'succeeded',
          activityId,
          activityType: activity.type,
        })
        return
      }
      await recordIntegrationSyncSuccess(STRAVA_SYNC_PROVIDER, {
        trigger,
        status: 'succeeded',
        activityId,
        activityType: activity.type,
        skipped: true,
      })
      return
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

    await recordIntegrationSyncSuccess(STRAVA_SYNC_PROVIDER, {
      trigger,
      status: 'succeeded',
      activityId,
      syncedRunId: runningSync.id,
      matchedPlannedSession: planned?.id ?? null,
    })
  } catch (error) {
    console.error('Error processing Strava webhook:', error)
    await recordIntegrationSyncFailure(STRAVA_SYNC_PROVIDER, error, {
      trigger,
      status: 'failed',
      activityId,
    })
  }
}
