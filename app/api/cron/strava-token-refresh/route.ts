import { NextRequest, NextResponse } from 'next/server'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/strava-token-refresh
 * Proactively refresh the Strava access token every 5 hours.
 *
 * Strava tokens expire every 6 hours. By refreshing proactively on a schedule,
 * we avoid the race condition where multiple concurrent serverless functions
 * all try to refresh an expired token simultaneously.
 *
 * Runs every 5 hours via Vercel cron.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = await getStravaAccessToken()

    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'No Strava token in DB — re-auth needed at /api/gym/sync/strava/auth',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Strava token is valid',
    })
  } catch (error) {
    console.error('Strava token refresh cron error:', error)
    return NextResponse.json({ success: false, error: 'Token refresh failed' }, { status: 500 })
  }
}
