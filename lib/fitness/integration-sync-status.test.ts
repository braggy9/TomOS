import { describe, expect, it } from 'vitest'
import { isIntegrationSyncStale } from './integration-sync-status'

describe('isIntegrationSyncStale', () => {
  const now = new Date('2026-08-17T00:00:00.000Z')

  it('treats a recent successful sync as healthy', () => {
    expect(isIntegrationSyncStale('2026-08-16T12:00:00.000Z', now)).toBe(false)
  })

  it('treats a sync older than 36 hours as stale', () => {
    expect(isIntegrationSyncStale('2026-08-15T11:59:59.000Z', now)).toBe(true)
  })

  it('treats missing or invalid timestamps as stale', () => {
    expect(isIntegrationSyncStale(null, now)).toBe(true)
    expect(isIntegrationSyncStale('not-a-date', now)).toBe(true)
  })
})

