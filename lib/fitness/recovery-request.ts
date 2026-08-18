import { getSydneyDayBoundsForDate } from '../sydney-time'

export interface RecoveryHistoryOptions {
  days: number
  limit: number
}

function parseBoundedInteger(value: string | null, fallback: number, maximum: number): number {
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback

  return Math.min(Math.max(parsed, 1), maximum)
}

export function parseRecoveryHistoryOptions(searchParams: URLSearchParams): RecoveryHistoryOptions {
  return {
    days: parseBoundedInteger(searchParams.get('days'), 30, 365),
    limit: parseBoundedInteger(searchParams.get('limit'), 30, 100),
  }
}

export function getRecoveryHistoryStart(todayDateStr: string, days: number): Date {
  const [year, month, day] = todayDateStr.split('-').map(Number)
  const firstDate = new Date(Date.UTC(year, month - 1, day - (days - 1))).toISOString().slice(0, 10)

  return getSydneyDayBoundsForDate(firstDate).startOfDay
}
