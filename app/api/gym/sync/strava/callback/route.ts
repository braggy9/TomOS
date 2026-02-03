import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/gym/sync/strava/callback
 * Handles Strava OAuth callback — exchanges code for tokens and stores them
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return new NextResponse(
        html('Authorization Denied', 'You denied access to Strava. Close this window and try again.'),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code || !state) {
      return new NextResponse(
        html('Error', 'Missing code or state parameter.'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Verify CSRF state
    const cookieStore = await cookies()
    const storedState = cookieStore.get('strava_oauth_state')?.value
    if (!storedState || storedState !== state) {
      return new NextResponse(
        html('Error', 'Invalid state parameter. Possible CSRF attack.'),
        { status: 403, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Clear the state cookie
    cookieStore.delete('strava_oauth_state')

    // Exchange code for tokens
    const clientId = process.env.STRAVA_CLIENT_ID?.trim()
    const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim()

    if (!clientId || !clientSecret) {
      return new NextResponse(
        html('Error', 'Strava client credentials not configured.'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      console.error('Strava token exchange failed:', errorText)
      return new NextResponse(
        html('Error', 'Failed to exchange authorization code.'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    const data = await tokenRes.json()

    // Store tokens in database
    await prisma.stravaToken.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athleteId: data.athlete?.id ?? null,
      },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athleteId: data.athlete?.id ?? null,
      },
    })

    const athleteName = data.athlete
      ? `${data.athlete.firstname} ${data.athlete.lastname}`
      : 'Unknown'

    return new NextResponse(
      html('Connected!', `Strava account connected for ${athleteName}. You can close this window.`),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('Strava callback error:', error)
    return new NextResponse(
      html('Error', 'Something went wrong during authorization.'),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }
}

function html(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><title>FitnessOS — ${title}</title>
<style>body{font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#333}
h1{color:#7c3aed}p{font-size:18px;line-height:1.5}</style></head>
<body><h1>${title}</h1><p>${message}</p></body></html>`
}
