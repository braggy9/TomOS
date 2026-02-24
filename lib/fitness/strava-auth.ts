import { prisma } from '@/lib/prisma'

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

/**
 * Get a valid Strava access token, auto-refreshing if expired.
 * Returns null if no tokens are stored (user hasn't authorized yet).
 */
export async function getStravaAccessToken(): Promise<string | null> {
  const token = await prisma.stravaToken.findUnique({
    where: { id: 'singleton' },
  })

  if (!token) return null

  // Refresh 5 minutes early to avoid edge cases
  const nowEpoch = Math.floor(Date.now() / 1000)
  if (nowEpoch > token.expiresAt - 300) {
    const refreshed = await refreshStravaToken(token.refreshToken)
    return refreshed?.accessToken ?? null
  }

  return token.accessToken
}

/**
 * Refresh the Strava access token using the refresh token.
 * Upserts the new tokens into the database.
 */
export async function refreshStravaToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET not configured')
    return null
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    console.error('Strava token refresh failed:', res.status, await res.text())
    return null
  }

  const data = await res.json()

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
    },
  })

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  }
}
