import { prisma } from '@/lib/prisma'
import { classifyLoad } from './running-load'
import type { WeightSuggestion, WeekType, ExerciseCategory, LoadFactor } from '@/types/fitness'

// Category-aware weight increments (kg)
const WEIGHT_INCREMENT: Record<string, number> = {
  power: 2.5,
  strength: 2.5,
  accessory: 1,
  core: 0,
  warmup: 0,
  conditioning: 0,
}

// Default sets/reps by category
const DEFAULT_PRESCRIPTION: Record<string, { sets: number; reps: number }> = {
  power: { sets: 4, reps: 5 },
  strength: { sets: 4, reps: 6 },
  accessory: { sets: 3, reps: 10 },
  core: { sets: 3, reps: 12 },
  warmup: { sets: 2, reps: 10 },
  conditioning: { sets: 3, reps: 12 },
}

// Movement patterns associated with lower body
const LOWER_BODY_PATTERNS = ['hip_hinge', 'squat', 'hip_extension']

interface ExerciseHistoryEntry {
  sets: Array<{ weight: number | null; reps: number | null; rpe: number | null; setNumber: number }>
  session: { date: Date; weekType: string | null }
}

interface PrefetchedContext {
  history: ExerciseHistoryEntry[]
  runningLoad: number
  loadFactor: LoadFactor
  category: ExerciseCategory | string
  movementPattern: string | null
}

/**
 * Suggest next weight, sets, and reps for an exercise.
 * Accepts prefetched data to avoid N+1 queries when called in a loop.
 */
export function suggestWeightFromData(
  prefetched: PrefetchedContext,
  weekType?: WeekType,
  recoveryScore?: number | null
): WeightSuggestion {
  const { history, runningLoad, loadFactor, category, movementPattern } = prefetched

  const isLowerBody = movementPattern ? LOWER_BODY_PATTERNS.includes(movementPattern) : false
  const increment = isLowerBody ? 2.5 : (WEIGHT_INCREMENT[category] ?? 1.25)
  const prescription = DEFAULT_PRESCRIPTION[category] ?? { sets: 3, reps: 8 }

  if (history.length === 0) {
    return {
      weight: 0,
      sets: prescription.sets,
      reps: prescription.reps,
      confidence: 'low',
      rationale: 'No history — start light and focus on form',
    }
  }

  // Confidence based on data availability
  const confidence: WeightSuggestion['confidence'] =
    history.length >= 4 ? 'high' : history.length >= 2 ? 'medium' : 'low'

  // Analyze recent sets
  const recentSets = history.flatMap(h => h.sets)
  const setsWithRPE = recentSets.filter(s => s.rpe != null)
  const avgRPE = setsWithRPE.length > 0
    ? setsWithRPE.reduce((sum, s) => sum + (s.rpe || 7), 0) / setsWithRPE.length
    : 7

  const setsWithWeight = recentSets.filter(s => s.weight != null && s.weight > 0)
  const lastWeight = setsWithWeight.length > 0 ? setsWithWeight[0].weight! : 0
  const lastReps = recentSets.find(s => s.reps != null)?.reps ?? prescription.reps

  // Most recent session's set count
  const lastSetCount = history[0]?.sets.length ?? prescription.sets

  if (lastWeight === 0) {
    return {
      weight: 0,
      sets: prescription.sets,
      reps: prescription.reps,
      confidence: 'low',
      rationale: 'No weight history — start light and focus on form',
    }
  }

  // Kid week: reduce volume (fewer sets), not just weight
  const isKidWeek = weekType === 'kid'
  const kidSetReduction = isKidWeek ? 1 : 0
  const targetSets = Math.max(2, lastSetCount - kidSetReduction)

  // Recovery factor
  const lowRecovery = recoveryScore != null && recoveryScore < 3

  // Decision matrix
  if (avgRPE > 8.5 || lowRecovery) {
    const reason = lowRecovery
      ? `Recovery score low (${recoveryScore}). Deload to ${lastWeight - increment}kg.`
      : `RPE very high (${avgRPE.toFixed(1)}). Deload to ${lastWeight - increment}kg.`
    return {
      weight: Math.max(0, lastWeight - increment),
      sets: targetSets,
      reps: lastReps,
      confidence,
      rationale: reason,
    }
  }

  if (avgRPE > 8 || loadFactor === 'high') {
    const reason = loadFactor === 'high'
      ? `Heavy running week (load: ${runningLoad}). Maintain weight, focus on quality.`
      : `RPE was high (${avgRPE.toFixed(1)}). Consolidate before progressing.`
    return {
      weight: lastWeight,
      sets: targetSets,
      reps: lastReps,
      confidence,
      rationale: reason,
    }
  }

  if (isKidWeek) {
    return {
      weight: lastWeight,
      sets: targetSets,
      reps: lastReps,
      confidence,
      rationale: `Kid week: maintain ${lastWeight}kg, reduced to ${targetSets} sets.`,
    }
  }

  if (avgRPE < 7) {
    return {
      weight: lastWeight + increment,
      sets: lastSetCount,
      reps: lastReps,
      confidence,
      rationale: `RPE low (${avgRPE.toFixed(1)}), running load manageable (${runningLoad}). Progress to ${lastWeight + increment}kg.`,
    }
  }

  return {
    weight: lastWeight,
    sets: lastSetCount,
    reps: lastReps,
    confidence,
    rationale: `On track. Maintain ${lastWeight}kg. RPE: ${avgRPE.toFixed(1)}, Running load: ${runningLoad}.`,
  }
}

/**
 * Standalone version that fetches its own data (for single-exercise lookups).
 */
export async function suggestWeight(
  exerciseId: string,
  weekType?: WeekType
): Promise<WeightSuggestion> {
  const { getWeeklyRunningLoad } = await import('./running-load')

  const [history, exercise, runningLoad] = await Promise.all([
    prisma.sessionExercise.findMany({
      where: { exerciseId },
      include: {
        sets: { orderBy: { setNumber: 'asc' } },
        session: { select: { date: true, weekType: true } },
      },
      orderBy: { session: { date: 'desc' } },
      take: 5,
    }),
    prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { category: true, movementPattern: true },
    }),
    getWeeklyRunningLoad(),
  ])

  return suggestWeightFromData(
    {
      history,
      runningLoad,
      loadFactor: classifyLoad(runningLoad),
      category: exercise?.category ?? 'strength',
      movementPattern: exercise?.movementPattern ?? null,
    },
    weekType
  )
}
