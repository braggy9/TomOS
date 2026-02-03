import { prisma } from '@/lib/prisma'
import { getWeeklyRunningLoad, classifyLoad } from './running-load'
import type { WeightSuggestion, WeekType } from '@/types/fitness'

/**
 * Suggest next weight for an exercise based on:
 * - Last 3-5 sessions with this exercise
 * - RPE trends
 * - Weekly running load
 * - Kid week vs non-kid week
 */
export async function suggestWeight(
  exerciseId: string,
  weekType?: WeekType
): Promise<WeightSuggestion> {
  // Get last 5 sessions with this exercise
  const history = await prisma.sessionExercise.findMany({
    where: { exerciseId },
    include: {
      sets: { orderBy: { setNumber: 'asc' } },
      session: { select: { date: true, weekType: true } },
    },
    orderBy: { session: { date: 'desc' } },
    take: 5,
  })

  if (history.length === 0) {
    return {
      weight: 0,
      rationale: 'No history — start light and focus on form',
    }
  }

  // Analyze recent sets
  const recentSets = history.flatMap(h => h.sets)
  const setsWithRPE = recentSets.filter(s => s.rpe != null)
  const avgRPE = setsWithRPE.length > 0
    ? setsWithRPE.reduce((sum, s) => sum + (s.rpe || 7), 0) / setsWithRPE.length
    : 7

  const setsWithWeight = recentSets.filter(s => s.weight != null && s.weight > 0)
  const lastWeight = setsWithWeight.length > 0 ? setsWithWeight[0].weight! : 0

  if (lastWeight === 0) {
    return {
      weight: 0,
      rationale: 'No weight history — start light and focus on form',
    }
  }

  // Get running load
  const runningLoad = await getWeeklyRunningLoad()
  const loadFactor = classifyLoad(runningLoad)

  // Week type factor
  const weekFactor = weekType === 'kid' ? 'conservative' : 'normal'

  // Decision matrix (from SPEC.md)
  if (avgRPE > 8.5) {
    return {
      weight: lastWeight - 2.5,
      rationale: `RPE very high (${avgRPE.toFixed(1)}). Deload slightly to ${lastWeight - 2.5}kg.`,
    }
  }

  if (avgRPE > 8 || loadFactor === 'high') {
    const reason = loadFactor === 'high'
      ? `Heavy running week (load: ${runningLoad}). Maintain weight, focus on quality.`
      : `RPE was high (${avgRPE.toFixed(1)}). Consolidate before progressing.`
    return { weight: lastWeight, rationale: reason }
  }

  if (avgRPE < 7 && weekFactor === 'normal') {
    return {
      weight: lastWeight + 2.5,
      rationale: `RPE low (${avgRPE.toFixed(1)}), running load manageable (${runningLoad}). Progress to ${lastWeight + 2.5}kg.`,
    }
  }

  return {
    weight: lastWeight,
    rationale: `On track. Maintain ${lastWeight}kg. RPE: ${avgRPE.toFixed(1)}, Running load: ${runningLoad}.`,
  }
}
