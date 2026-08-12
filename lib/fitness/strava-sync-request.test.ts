import { describe, expect, it } from 'vitest'

import { authorizeCronRequest, parseStravaSyncDays } from './strava-sync-request'

describe('authorizeCronRequest', () => {
  it('fails closed when CRON_SECRET is not configured', () => {
    expect(authorizeCronRequest(null, undefined)).toBe('missing-secret')
  })

  it('rejects a missing or incorrect bearer token', () => {
    expect(authorizeCronRequest(null, 'secret')).toBe('unauthorized')
    expect(authorizeCronRequest('Bearer wrong', 'secret')).toBe('unauthorized')
  })

  it('accepts the configured bearer token', () => {
    expect(authorizeCronRequest('Bearer secret', 'secret')).toBe('authorized')
  })
})

describe('parseStravaSyncDays', () => {
  it('uses the caller default for absent or malformed input', () => {
    expect(parseStravaSyncDays(null, 14)).toBe(14)
    expect(parseStravaSyncDays('abc', 14)).toBe(14)
    expect(parseStravaSyncDays('1.5', 14)).toBe(14)
  })

  it('clamps whole-day windows to the supported range', () => {
    expect(parseStravaSyncDays('0', 14)).toBe(1)
    expect(parseStravaSyncDays('30', 14)).toBe(30)
    expect(parseStravaSyncDays('500', 14)).toBe(365)
  })
})
