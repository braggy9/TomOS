import { NextRequest, NextResponse } from 'next/server'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'

/**
 * POST /api/gym/sync/strava/refresh
 * Manually trigger a Strava token refresh
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getStravaAccessToken()

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No Strava tokens found. Authorize first via /api/gym/sync/strava/auth' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Token is valid (refreshed if needed)',
    })
  } catch (error) {
    console.error('Error refreshing Strava token:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}
