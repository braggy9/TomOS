import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

export function secretsMatch(candidate: string | null | undefined, expected: string | null | undefined): boolean {
  if (!candidate || !expected) return false
  return timingSafeEqual(digest(candidate), digest(expected))
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export function hasTrainingReadAccess(request: Request): boolean {
  return secretsMatch(bearerToken(request), process.env.TOMOS_TRAINING_READ_TOKEN)
}

export function hasCronAccess(request: Request): boolean {
  return secretsMatch(bearerToken(request), process.env.CRON_SECRET)
}

export function protectedEndpointError(secretConfigured: boolean, error: string): NextResponse {
  return NextResponse.json(
    { success: false, error: secretConfigured ? error : 'server_auth_not_configured' },
    {
      status: secretConfigured ? 401 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    }
  )
}

export function requireTrainingReadAccess(request: Request): NextResponse | null {
  if (hasTrainingReadAccess(request)) return null
  return protectedEndpointError(Boolean(process.env.TOMOS_TRAINING_READ_TOKEN), 'training_data_unauthorized')
}

export function requireCronAccess(request: Request): NextResponse | null {
  if (hasCronAccess(request)) return null
  return protectedEndpointError(Boolean(process.env.CRON_SECRET), 'cron_unauthorized')
}
