import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCronAccess } from '@/lib/server-auth'

const RadarResponse = z.object({
  degraded: z.boolean(),
  sourceHealth: z.record(z.object({ status: z.enum(['healthy', 'unavailable']) })),
  calendar: z.object({
    totalSlippedSessions: z.number().int().nonnegative(),
    totalNeedsClassification: z.number().int().nonnegative(),
  }),
  raceRadar: z.object({
    totalUnconfirmedRaces: z.number().int().nonnegative(),
  }),
  recoveryCrossCheck: z.object({
    recoveryStale: z.boolean(),
    strava: z.object({
      syncHealth: z.object({ stale: z.boolean() }).nullable(),
    }),
  }),
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authError = requireCronAccess(request)
  if (authError) return authError

  const radarToken = process.env.TRAINING_RADAR_READ_TOKEN?.trim()
  const radarUrl = process.env.TRAINING_RADAR_ENDPOINT?.trim()
    || 'https://tomos-dashboard.vercel.app/api/training-radar'

  if (!radarToken) {
    return NextResponse.json(
      { success: false, error: 'training_radar_monitor_not_configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const radarResponse = await fetch(radarUrl, {
      headers: { Authorization: `Bearer ${radarToken}` },
      cache: 'no-store',
    })

    if (!radarResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'training_radar_fetch_failed', status: radarResponse.status },
        { status: 502 }
      )
    }

    const parsed = RadarResponse.safeParse(await radarResponse.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'training_radar_response_invalid' },
        { status: 502 }
      )
    }

    const radar = parsed.data
    const unavailableSources = Object.entries(radar.sourceHealth)
      .filter(([, source]) => source.status !== 'healthy')
      .map(([name]) => name)
    const openItems =
      radar.calendar.totalSlippedSessions
      + radar.calendar.totalNeedsClassification
      + radar.raceRadar.totalUnconfirmedRaces
    const stravaStale = !radar.recoveryCrossCheck.strava.syncHealth
      || radar.recoveryCrossCheck.strava.syncHealth.stale
    const needsAttention = radar.degraded || openItems > 0 || radar.recoveryCrossCheck.recoveryStale || stravaStale

    if (!needsAttention) {
      return NextResponse.json({ success: true, skipped: true, reason: 'nothing_needs_attention' })
    }

    const details: string[] = []
    if (unavailableSources.length > 0) details.push(`${unavailableSources.length} checks unavailable`)
    if (radar.calendar.totalSlippedSessions > 0) {
      details.push(`${radar.calendar.totalSlippedSessions} slipped session${radar.calendar.totalSlippedSessions === 1 ? '' : 's'}`)
    }
    if (radar.calendar.totalNeedsClassification > 0) {
      details.push(`${radar.calendar.totalNeedsClassification} Calendar status to review`)
    }
    if (radar.raceRadar.totalUnconfirmedRaces > 0) {
      details.push(`${radar.raceRadar.totalUnconfirmedRaces} race registration gap${radar.raceRadar.totalUnconfirmedRaces === 1 ? '' : 's'}`)
    }
    if (radar.recoveryCrossCheck.recoveryStale) details.push('recovery check-in stale')
    if (stravaStale) details.push('Strava stale')

    const pushResponse = await fetch(new URL('/api/send-push', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        title: 'Training Radar needs attention',
        body: details.join(' | '),
        badge: Math.max(1, openItems),
      }),
    })
    const pushResult = await pushResponse.json() as { success?: boolean }

    if (!pushResponse.ok || pushResult.success === false) {
      return NextResponse.json(
        { success: false, error: 'training_radar_push_failed', push: pushResult },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, skipped: false, attention: details, push: pushResult })
  } catch (error) {
    console.error('Training Radar notification failed:', error)
    return NextResponse.json(
      { success: false, error: 'training_radar_notification_failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
