export type CronAuthorization = 'authorized' | 'missing-secret' | 'unauthorized'

export function authorizeCronRequest(
  authorizationHeader: string | null,
  cronSecret: string | undefined
): CronAuthorization {
  if (!cronSecret) return 'missing-secret'
  return authorizationHeader === `Bearer ${cronSecret}` ? 'authorized' : 'unauthorized'
}

export function parseStravaSyncDays(value: string | null, defaultDays: number): number {
  if (!value) return defaultDays

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return defaultDays

  return Math.min(Math.max(parsed, 1), 365)
}
