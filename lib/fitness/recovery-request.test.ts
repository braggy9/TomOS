import { describe, expect, it } from 'vitest'

import { getRecoveryHistoryStart, parseRecoveryHistoryOptions } from './recovery-request'

describe('parseRecoveryHistoryOptions', () => {
  it('uses defaults for absent or malformed values', () => {
    expect(parseRecoveryHistoryOptions(new URLSearchParams())).toEqual({ days: 30, limit: 30 })
    expect(parseRecoveryHistoryOptions(new URLSearchParams('days=1.5&limit=nope'))).toEqual({
      days: 30,
      limit: 30,
    })
  })

  it('clamps whole-number values to supported ranges', () => {
    expect(parseRecoveryHistoryOptions(new URLSearchParams('days=0&limit=0'))).toEqual({
      days: 1,
      limit: 1,
    })
    expect(parseRecoveryHistoryOptions(new URLSearchParams('days=500&limit=500'))).toEqual({
      days: 365,
      limit: 100,
    })
  })
})

describe('getRecoveryHistoryStart', () => {
  it('treats the requested history as inclusive Sydney calendar days', () => {
    expect(getRecoveryHistoryStart('2026-08-19', 1).toISOString()).toBe('2026-08-18T14:00:00.000Z')
    expect(getRecoveryHistoryStart('2026-08-19', 30).toISOString()).toBe('2026-07-20T14:00:00.000Z')
  })
})
