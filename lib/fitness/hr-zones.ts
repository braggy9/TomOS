/**
 * Heart Rate Zone Calculations
 * Uses standard 5-zone model based on max heart rate
 */

export interface HRZone {
  zone: number
  min: number
  max: number
  name: string
}

export interface ZoneTime {
  zone: number
  name: string
  minutes: number
  percentage: number
}

/**
 * Calculate HR zones from max heart rate using standard percentages.
 * Z1: 50-60%, Z2: 60-70%, Z3: 70-80%, Z4: 80-90%, Z5: 90-100%
 */
export function calculateZones(maxHR: number): HRZone[] {
  return [
    { zone: 1, min: Math.round(maxHR * 0.50), max: Math.round(maxHR * 0.60), name: 'Recovery' },
    { zone: 2, min: Math.round(maxHR * 0.60), max: Math.round(maxHR * 0.70), name: 'Aerobic' },
    { zone: 3, min: Math.round(maxHR * 0.70), max: Math.round(maxHR * 0.80), name: 'Tempo' },
    { zone: 4, min: Math.round(maxHR * 0.80), max: Math.round(maxHR * 0.90), name: 'Threshold' },
    { zone: 5, min: Math.round(maxHR * 0.90), max: maxHR, name: 'VO2 Max' },
  ]
}

/**
 * Get the zone number for a given heart rate
 */
export function getZoneForHR(hr: number, maxHR: number): number {
  const pct = hr / maxHR
  if (pct >= 0.90) return 5
  if (pct >= 0.80) return 4
  if (pct >= 0.70) return 3
  if (pct >= 0.60) return 2
  return 1
}

/**
 * Calculate time spent in each zone from splits data.
 * Each split has avgHR and timeSec.
 */
export function calculateZoneTime(
  splits: Array<{ avgHR?: number | null; timeSec: number }>,
  maxHR: number
): ZoneTime[] {
  const zones = calculateZones(maxHR)
  const zoneMinutes = [0, 0, 0, 0, 0]
  let totalSeconds = 0

  for (const split of splits) {
    if (split.avgHR && split.timeSec > 0) {
      const zone = getZoneForHR(split.avgHR, maxHR)
      zoneMinutes[zone - 1] += split.timeSec / 60
      totalSeconds += split.timeSec
    }
  }

  const totalMinutes = totalSeconds / 60

  return zones.map((z, i) => ({
    zone: z.zone,
    name: z.name,
    minutes: Math.round(zoneMinutes[i] * 10) / 10,
    percentage: totalMinutes > 0 ? Math.round((zoneMinutes[i] / totalMinutes) * 100) : 0,
  }))
}
