/**
 * Sydney timezone utilities.
 *
 * Dates in the database are stored as UTC. To query "today in Sydney",
 * we need the UTC timestamps that correspond to midnight→23:59:59 in
 * Australia/Sydney.
 *
 * The old pattern (`new Date(now.toLocaleString('en-US', { timeZone }))`)
 * produces a Date whose hours are the Sydney wall-clock values but whose
 * internal UTC offset is the server's local zone (UTC on Vercel).
 * setHours(0,0,0,0) then sets midnight *in server-local time*, not in
 * Sydney — off by up to 11 hours.
 *
 * Fix: use Intl.DateTimeFormat to extract the Sydney UTC offset, then
 * compute the real UTC timestamps for Sydney day boundaries.
 */

/**
 * Get the current UTC offset for Australia/Sydney in milliseconds.
 * Handles AEDT (UTC+11) and AEST (UTC+10) automatically.
 */
function getSydneyOffsetMs(): number {
  const now = new Date()
  // Format the current time as if in UTC and as if in Sydney,
  // then compare the two to find the offset.
  const utcParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const sydneyParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const extract = (parts: Intl.DateTimeFormatPart[]) => {
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  }

  return extract(sydneyParts).getTime() - extract(utcParts).getTime()
}

export interface SydneyDayBounds {
  /** UTC timestamp for 00:00:00.000 Sydney time */
  startOfDay: Date
  /** UTC timestamp for 23:59:59.999 Sydney time */
  endOfDay: Date
  /** The Sydney date as YYYY-MM-DD */
  dateStr: string
  /** The Date object with Sydney wall-clock values (for getDay(), getHours(), etc.) */
  sydneyDate: Date
}

/**
 * Get the UTC day boundaries for "today" in Sydney timezone.
 * Use startOfDay/endOfDay in Prisma `where` clauses to match
 * records whose UTC date falls within the Sydney calendar day.
 */
export function getSydneyToday(): SydneyDayBounds {
  const offsetMs = getSydneyOffsetMs()
  const now = new Date()

  // Sydney wall-clock as a Date (for extracting day-of-week, formatting, etc.)
  const sydneyDate = new Date(now.getTime() + offsetMs)

  // Midnight Sydney = take the Sydney date at 00:00:00, convert back to UTC
  const midnightSydney = new Date(Date.UTC(
    sydneyDate.getUTCFullYear(),
    sydneyDate.getUTCMonth(),
    sydneyDate.getUTCDate(),
    0, 0, 0, 0
  ))
  // Convert from "Sydney midnight" to actual UTC
  const startOfDay = new Date(midnightSydney.getTime() - offsetMs)
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

  const dateStr = `${sydneyDate.getUTCFullYear()}-${String(sydneyDate.getUTCMonth() + 1).padStart(2, '0')}-${String(sydneyDate.getUTCDate()).padStart(2, '0')}`

  return { startOfDay, endOfDay, dateStr, sydneyDate }
}

/**
 * Get the UTC day boundaries for a specific Sydney date.
 * Useful for prescriptions targeting a future date.
 */
export function getSydneyDayBounds(date: Date): { startOfDay: Date; endOfDay: Date } {
  const offsetMs = getSydneyOffsetMs()

  const midnightUTC = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    0, 0, 0, 0
  ))
  const startOfDay = new Date(midnightUTC.getTime() - offsetMs)
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

  return { startOfDay, endOfDay }
}
