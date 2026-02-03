import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/gym/sync/strava/auth
 * Redirects to Strava OAuth authorization page
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'STRAVA_CLIENT_ID not configured' },
      { status: 500 }
    )
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://tomos-task-api.vercel.app'}/api/gym/sync/strava/callback`

  // Generate CSRF state token
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('strava_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'force',
    scope: 'read,activity:read_all',
    state,
  })

  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params}`)
}
