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

    // Fetch last 30 days of activities
    const after = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
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

    // Filter to running activities only
    const runs = activities.filter(
      (a: any) => a.type === 'Run' || a.type === 'TrailRun'
    )

    let synced = 0
    let skipped = 0

    for (const activity of runs) {
      // Classify run type by name patterns first, fall back to metrics
      const runType = classifyRunTypeByName(activity.name) || classifyRunType(activity)

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
