import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSydneyDayBoundsForDate, getSydneyToday } from './sydney-time'

afterEach(() => {
  vi.useRealTimers()
})

describe('getSydneyDayBoundsForDate', () => {
  it('uses the AEST offset in winter', () => {
    const bounds = getSydneyDayBoundsForDate('2026-08-19')

    expect(bounds.startOfDay.toISOString()).toBe('2026-08-18T14:00:00.000Z')
    expect(bounds.endOfDay.toISOString()).toBe('2026-08-19T13:59:59.999Z')
  })

  it('uses the AEDT offset in summer', () => {
    const bounds = getSydneyDayBoundsForDate('2026-01-15')

    expect(bounds.startOfDay.toISOString()).toBe('2026-01-14T13:00:00.000Z')
    expect(bounds.endOfDay.toISOString()).toBe('2026-01-15T12:59:59.999Z')
  })

  it('allows the spring transition day to be 23 hours', () => {
    const bounds = getSydneyDayBoundsForDate('2026-10-04')

    expect(bounds.startOfDay.toISOString()).toBe('2026-10-03T14:00:00.000Z')
    expect(bounds.endOfDay.toISOString()).toBe('2026-10-04T12:59:59.999Z')
  })

  it('allows the autumn transition day to be 25 hours', () => {
    const bounds = getSydneyDayBoundsForDate('2026-04-05')

    expect(bounds.startOfDay.toISOString()).toBe('2026-04-04T13:00:00.000Z')
    expect(bounds.endOfDay.toISOString()).toBe('2026-04-05T13:59:59.999Z')
  })

  it('uses exact transition-day bounds for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:30:00.000Z'))

    const today = getSydneyToday()

    expect(today.dateStr).toBe('2026-10-04')
    expect(today.startOfDay.toISOString()).toBe('2026-10-03T14:00:00.000Z')
    expect(today.endOfDay.toISOString()).toBe('2026-10-04T12:59:59.999Z')
  })
})
