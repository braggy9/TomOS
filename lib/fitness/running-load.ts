import { prisma } from '@/lib/prisma'
import type { LoadFactor } from '@/types/fitness'

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
 * Classify running load as low/moderate/high
 */
export function classifyLoad(load: number): LoadFactor {
  if (load > 500) return 'high'
  if (load > 300) return 'moderate'
  return 'low'
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
