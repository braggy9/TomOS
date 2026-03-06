import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'
import { calculateTrainingLoad, classifyRunType, calculatePace } from '@/lib/fitness/running-load'

/**
 * POST /api/gym/sync/strava/manual
 * Manually sync running activities from Strava (last 30 days)
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getStravaAccessToken()
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'No Strava token. Authorize first via /api/gym/sync/strava/auth' },
        { status: 401 }
      )
    }

    // Accept ?days= parameter (default 90, max 365)
    const daysParam = parseInt(request.nextUrl.searchParams.get('days') || '90')
    const days = Math.min(Math.max(daysParam, 1), 365)
    const after = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60
    const params = new URLSearchParams({
      after: String(after),
      per_page: '100',
    })

    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Strava API error:', res.status, errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch Strava activities' },
        { status: 502 }
      )
    }

    const activities = await res.json()

    // Split into runs and other activities
    const runs = activities.filter(
      (a: any) => a.type === 'Run' || a.type === 'TrailRun'
    )

    // Sync non-run activities to Activity table
    const NON_RUN_TYPES = ['Swim', 'Workout', 'Yoga', 'Walk', 'Hike', 'Ride', 'WeightTraining', 'Crossfit']
    const typeMap: Record<string, string> = {
      Swim: 'swim', Workout: 'workout', Yoga: 'yoga', Walk: 'walk',
      Hike: 'walk', Ride: 'cross-train', WeightTraining: 'workout', Crossfit: 'workout',
    }
    const otherActivities = activities.filter((a: any) => NON_RUN_TYPES.includes(a.type))
    let activitiesSynced = 0
    for (const a of otherActivities) {
      try {
        await prisma.activity.upsert({
          where: { externalId: String(a.id) },
          create: {
            externalId: String(a.id),
            source: 'strava',
            date: new Date(a.start_date),
            activityType: typeMap[a.type] || 'other',
            duration: Math.round(a.moving_time / 60),
            distance: a.distance ? a.distance / 1000 : null,
            avgHeartRate: a.average_heartrate || null,
            calories: a.calories || null,
            activityName: a.name || null,
          },
          update: {
            date: new Date(a.start_date),
            activityType: typeMap[a.type] || 'other',
            duration: Math.round(a.moving_time / 60),
            distance: a.distance ? a.distance / 1000 : null,
            avgHeartRate: a.average_heartrate || null,
            calories: a.calories || null,
            activityName: a.name || null,
          },
        })
        activitiesSynced++
      } catch (err) {
        console.error(`Failed to sync activity ${a.id}:`, err)
      }
    }

    let synced = 0
    let skipped = 0
    let enriched = 0

    for (const activity of runs) {
      // Classify run type by name patterns first, fall back to metrics
      const runType = classifyRunTypeByName(activity.name) || classifyRunType(activity)

      // Fetch individual activity details for richer data (splits, max HR, etc.)
      let detail = null
      try {
        const detailRes = await fetch(
          `https://www.strava.com/api/v3/activities/${activity.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (detailRes.ok) {
          detail = await detailRes.json()
          enriched++
        }
      } catch {
        // Non-critical — continue with summary data
      }

      const source = detail || activity

      // Parse splits from detailed activity
      const splits = detail?.splits_metric?.map((s: any, i: number) => ({
        km: i + 1,
        timeSec: s.elapsed_time || s.moving_time || 0,
        avgHR: s.average_heartrate || null,
        avgPace: s.moving_time && s.distance ? Math.round((s.moving_time / 60) / (s.distance / 1000) * 100) / 100 : null,
        elevation: s.elevation_difference || 0,
      })) || null

      try {
        await prisma.runningSync.upsert({
          where: { externalId: String(activity.id) },
          create: {
            externalId: String(activity.id),
            source: 'strava',
            date: new Date(activity.start_date),
            type: runType,
            distance: activity.distance / 1000,
            duration: Math.round(activity.moving_time / 60),
            avgPace: calculatePace(activity),
            avgHeartRate: activity.average_heartrate || null,
            elevationGain: activity.total_elevation_gain || null,
            trainingLoad: calculateTrainingLoad(activity),
            maxHeartRate: source.max_heartrate || null,
            avgCadence: source.average_cadence ? source.average_cadence * 2 : null,
            calories: source.calories || null,
            activityName: source.name || null,
            description: source.description || null,
            sufferScore: source.suffer_score || null,
            splits,
          },
          update: {
            date: new Date(activity.start_date),
            type: runType,
            distance: activity.distance / 1000,
            duration: Math.round(activity.moving_time / 60),
            avgPace: calculatePace(activity),
            avgHeartRate: activity.average_heartrate || null,
            elevationGain: activity.total_elevation_gain || null,
            trainingLoad: calculateTrainingLoad(activity),
            maxHeartRate: source.max_heartrate || null,
            avgCadence: source.average_cadence ? source.average_cadence * 2 : null,
            calories: source.calories || null,
            activityName: source.name || null,
            description: source.description || null,
            sufferScore: source.suffer_score || null,
            splits,
          },
        })
        synced++
      } catch (err) {
        console.error(`Failed to sync activity ${activity.id}:`, err)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        synced,
        skipped,
        enriched,
        activitiesSynced,
        totalActivities: activities.length,
        runsFound: runs.length,
      },
    })
  } catch (error) {
    console.error('Error during manual Strava sync:', error)
    return NextResponse.json(
      { success: false, error: 'Manual sync failed' },
      { status: 500 }
    )
  }
}

/**
 * Classify run type from activity name using regex patterns.
 * Returns null if no pattern matches (caller should fall back to metrics).
 */
function classifyRunTypeByName(name: string): string | null {
  const lower = name.toLowerCase()

  if (/\b(easy|recovery|shake[- ]?out)\b/.test(lower)) return 'easy'
  if (/\b(interval|speed|fartlek|repeats?|track)\b/.test(lower)) return 'intervals'
  if (/\b(tempo|threshold|cruise)\b/.test(lower)) return 'tempo'
  if (/\b(hill|hills|incline|elevation)\b/.test(lower)) return 'hills'
  if (/\b(long)\b/.test(lower)) return 'long'

  return null
}
