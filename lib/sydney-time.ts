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
function getSydneyOffsetMs(now = new Date()): number {
  const offsetName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney',
    timeZoneName: 'longOffset',
  }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value

  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offsetName || '')
  if (!match) throw new Error(`Unable to resolve Australia/Sydney offset: ${offsetName || 'missing'}`)

  const direction = match[1] === '+' ? 1 : -1
  const hours = Number(match[2])
  const minutes = Number(match[3])

  return direction * (hours * 60 + minutes) * 60 * 1000
}

function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) throw new Error(`Invalid Sydney date: ${dateStr}`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const normalised = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)

  if (normalised !== dateStr) throw new Error(`Invalid Sydney date: ${dateStr}`)

  return { year, month, day }
}

function sydneyMidnightUtc(dateStr: string): Date {
  const { year, month, day } = parseDateString(dateStr)
  const wallClockMidnight = Date.UTC(year, month - 1, day)
  let instant = new Date(wallClockMidnight)

  // The first offset guess can land across a DST boundary. Re-evaluate at the
  // candidate instant until the UTC representation of Sydney midnight settles.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = new Date(wallClockMidnight - getSydneyOffsetMs(instant))
    if (candidate.getTime() === instant.getTime()) return candidate
    instant = candidate
  }

  return instant
}

function addCalendarDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateString(dateStr)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
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
  const dateStr = `${sydneyDate.getUTCFullYear()}-${String(sydneyDate.getUTCMonth() + 1).padStart(2, '0')}-${String(sydneyDate.getUTCDate()).padStart(2, '0')}`
  const { startOfDay, endOfDay } = getSydneyDayBoundsForDate(dateStr)

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

/**
 * Get exact UTC bounds for a Sydney calendar date.
 *
 * Unlike getSydneyDayBounds(Date), this version resolves the offset on the
 * requested date and calculates the next local midnight independently. That
 * keeps history windows correct across daylight-saving transitions.
 */
export function getSydneyDayBoundsForDate(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = sydneyMidnightUtc(dateStr)
  const nextStartOfDay = sydneyMidnightUtc(addCalendarDays(dateStr, 1))

  return {
    startOfDay,
    endOfDay: new Date(nextStartOfDay.getTime() - 1),
  }
}
