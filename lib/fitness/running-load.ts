import { prisma } from '@/lib/prisma'
import type { LoadFactor, RunningLoadContext } from '@/types/fitness'

interface StravaActivity {
  moving_time: number       // seconds
  distance: number          // meters
  average_heartrate?: number
  total_elevation_gain?: number
}

/**
 * Calculate training load from a running activity (TRIMP-like)
 */
export function calculateTrainingLoad(activity: StravaActivity): number {
  const duration = activity.moving_time / 60 // minutes
  const distance = activity.distance / 1000  // km
  const avgHR = activity.average_heartrate || 140
  const elevationGain = activity.total_elevation_gain || 0

  // Base load from distance and duration
  let load = (distance * 10) + (duration * 0.5)

  // Intensity modifier from HR
  const hrModifier = avgHR > 160 ? 1.5 : avgHR > 145 ? 1.2 : 1.0
  load *= hrModifier

  // Elevation modifier
  load += elevationGain * 0.1

  return Math.round(load)
}

/**
 * Get total running training load over a given number of days
 */
export async function getWeeklyRunningLoad(days: number = 7): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const result = await prisma.runningSync.aggregate({
    where: { date: { gte: since } },
    _sum: { trainingLoad: true },
  })

  return result._sum.trainingLoad || 0
}

/**
 * Classify running load relative to personal baseline.
 * Falls back to hardcoded thresholds if not enough history for baseline.
 */
export function classifyLoad(load: number, baseline?: number | null): LoadFactor {
  if (baseline && baseline > 0) {
    const ratio = load / baseline
    if (ratio > 1.3) return 'high'
    if (ratio > 0.8) return 'moderate'
    return 'low'
  }
  // Fallback to absolute thresholds
  if (load > 500) return 'high'
  if (load > 300) return 'moderate'
  return 'low'
}

/**
 * Calculate Acute:Chronic Workload Ratio (ACWR)
 * Acute = 7-day rolling average daily load
 * Chronic = 28-day rolling average daily load
 */
export async function getACWR(): Promise<{ acwr: number; acute: number; chronic: number }> {
  const [acuteLoad, chronicLoad] = await Promise.all([
    getWeeklyRunningLoad(7),
    getWeeklyRunningLoad(28),
  ])

  const acuteAvg = acuteLoad / 7
  const chronicAvg = chronicLoad / 28

  const acwr = chronicAvg > 0 ? Math.round((acuteAvg / chronicAvg) * 100) / 100 : 0

  return { acwr, acute: acuteLoad, chronic: chronicLoad }
}

/**
 * Determine load trend by comparing last 7 days to the previous 7 days
 */
async function getLoadTrend(): Promise<'increasing' | 'decreasing' | 'stable'> {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(now.getDate() - 14)

  const [currentWeek, previousWeek] = await Promise.all([
    prisma.runningSync.aggregate({
      where: { date: { gte: sevenDaysAgo } },
      _sum: { trainingLoad: true },
    }),
    prisma.runningSync.aggregate({
      where: { date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _sum: { trainingLoad: true },
    }),
  ])

  const current = currentWeek._sum.trainingLoad || 0
  const previous = previousWeek._sum.trainingLoad || 0

  if (previous === 0) return 'stable'
  const ratio = current / previous
  if (ratio > 1.15) return 'increasing'
  if (ratio < 0.85) return 'decreasing'
  return 'stable'
}

/**
 * Rich running load context combining ACWR, trend, and recommendation.
 */
export async function getRunningLoadContext(): Promise<RunningLoadContext> {
  const [weeklyLoad, { acwr, acute, chronic }, trend] = await Promise.all([
    getWeeklyRunningLoad(7),
    getACWR(),
    getLoadTrend(),
  ])

  // Personal baseline is the 28-day weekly average
  const weeklyBaseline = chronic / 4
  const loadFactor = classifyLoad(weeklyLoad, weeklyBaseline || null)

  let recommendation: string
  if (acwr > 1.5) {
    recommendation = 'Spike detected — high injury risk. Consider rest or easy movement only.'
  } else if (acwr > 1.3) {
    recommendation = 'Load rising fast. Scale back intensity or skip high-impact work.'
  } else if (acwr < 0.5 && chronic > 0) {
    recommendation = 'Undertraining — ramp back up gradually.'
  } else if (acwr >= 0.8 && acwr <= 1.3) {
    recommendation = 'Sweet spot — load is well managed.'
  } else {
    recommendation = 'Moderate load. Continue as planned.'
  }

  return {
    weeklyLoad,
    acwr,
    acuteLoad: acute,
    chronicLoad: chronic,
    trend,
    loadFactor,
    recommendation,
  }
}

/**
 * Classify a Strava activity into a run type based on pace and HR
 */
export function classifyRunType(activity: StravaActivity): string {
  const paceMinPerKm = (activity.moving_time / 60) / (activity.distance / 1000)
  const avgHR = activity.average_heartrate || 0
  const distance = activity.distance / 1000

  if (distance > 12) return 'long'
  if (avgHR > 165 || paceMinPerKm < 4.5) return 'intervals'
  if (avgHR > 150 || paceMinPerKm < 5.0) return 'tempo'
  if ((activity.total_elevation_gain || 0) > 100) return 'hills'
  return 'easy'
}

/**
 * Calculate average pace (min/km) from a Strava activity
 */
export function calculatePace(activity: StravaActivity): number {
  const distanceKm = activity.distance / 1000
  if (distanceKm === 0) return 0
  const durationMin = activity.moving_time / 60
  return Math.round((durationMin / distanceKm) * 100) / 100
}
