import { prisma } from '@/lib/prisma'
import { getWeeklyRunningLoad, classifyLoad, getRunningLoadContext } from './running-load'
import { suggestWeightFromData } from './progressive-overload'
import type { SessionSuggestion, WeekType, ExerciseSuggestion, LoadFactor } from '@/types/fitness'

// Session templates define which exercises belong to each session type
const SESSION_TEMPLATES: Record<string, { name: string; day: string; exercisePatterns: string[] }> = {
  A: {
    name: 'Strength + Power',
    day: 'Tuesday',
    exercisePatterns: ['hip_hinge', 'squat', 'pull', 'anti_rotation', 'hip_extension'],
  },
  B: {
    name: 'Upper + Core',
    day: 'Friday',
    exercisePatterns: ['push', 'pull', 'carry', 'anti_extension'],
  },
  C: {
    name: 'CrossFit / Metcon',
    day: 'Sunday',
    exercisePatterns: ['compound', 'squat', 'hip_hinge', 'cardio'],
  },
}

// WOD templates — pick one based on available equipment
const WOD_TEMPLATES = [
  {
    name: 'AMRAP 15',
    format: 'amrap',
    duration: 15,
    description: 'As many rounds as possible in 15 minutes',
    slots: 3, // number of exercises to pick
    defaultReps: [10, 15, 20],
    requiresEquipment: [] as string[],
  },
  {
    name: 'EMOM 20',
    format: 'emom',
    duration: 20,
    description: 'Every minute on the minute for 20 minutes (alternate movements)',
    slots: 2,
    defaultReps: [10, 12],
    requiresEquipment: [],
  },
  {
    name: '21-15-9',
    format: 'fortime',
    duration: null,
    description: 'Complete 21-15-9 reps of each movement for time',
    slots: 2,
    defaultReps: [21, 15, 9],
    requiresEquipment: [],
  },
  {
    name: 'Tabata x4',
    format: 'tabata',
    duration: 16,
    description: '4 movements, 4 minutes each (20s work / 10s rest x 8)',
    slots: 4,
    defaultReps: [0], // time-based
    requiresEquipment: [],
  },
  {
    name: '5 Rounds',
    format: 'fortime',
    duration: null,
    description: '5 rounds for time',
    slots: 3,
    defaultReps: [10, 12, 15],
    requiresEquipment: [],
  },
]

/**
 * Recommend which session to do next, with exercise-level weight suggestions.
 * For Session C (CrossFit/Metcon), pass equipment to filter exercises by what's available.
 */
export async function getSessionSuggestion(
  weekType?: WeekType,
  equipment?: string[]
): Promise<SessionSuggestion> {
  // Batch fetch: last session + running load context + frequency stats in parallel
  const [lastSession, runningLoadCtx, frequencyStats] = await Promise.all([
    prisma.gymSession.findFirst({
      orderBy: { date: 'desc' },
      select: { sessionType: true, date: true },
    }),
    getRunningLoadContext(),
    getFrequencyStats(),
  ])

  const runningLoad = runningLoadCtx.weeklyLoad
  const loadFactor = runningLoadCtx.loadFactor

  // Determine week type
  const resolvedWeekType: WeekType = weekType || 'non-kid'

  // Determine which session to recommend
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  let recommendedSession = 'A'
  let rationale = ''

  // Gap detection: if last session was 5+ days ago, suggest easier re-entry
  const daysAgo = lastSession
    ? Math.floor((today.getTime() - lastSession.date.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isReEntry = daysAgo !== null && daysAgo >= 5

  if (lastSession) {
    const lastType = lastSession.sessionType

    // Rotate sessions
    if (lastType === 'A') {
      recommendedSession = 'B'
    } else if (lastType === 'B') {
      recommendedSession = resolvedWeekType === 'non-kid' ? 'C' : 'A'
    } else {
      recommendedSession = 'A'
    }

    // Override based on day of week
    if (dayOfWeek === 2) recommendedSession = 'A' // Tuesday
    if (dayOfWeek === 5) recommendedSession = 'B' // Friday
    if (dayOfWeek === 0 && resolvedWeekType === 'non-kid') recommendedSession = 'C' // Sunday

    // Kid week: skip Session C
    if (resolvedWeekType === 'kid' && recommendedSession === 'C') {
      recommendedSession = 'A'
    }

    // High running load: prefer upper body
    if (loadFactor === 'high' && recommendedSession === 'A') {
      rationale = `Heavy running week (load: ${runningLoad}). Switching to upper body focus.`
      recommendedSession = 'B'
    }
  }

  // Build rationale
  if (!rationale) {
    const template = SESSION_TEMPLATES[recommendedSession]
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
    rationale = `${dayName} — ${template?.name || 'Custom session'}. Running load ${loadFactor} (${runningLoad}).`
    if (resolvedWeekType === 'kid') {
      rationale += ' Kid week: focus on quality over volume.'
    }
    if (isReEntry) {
      rationale += ` ${daysAgo} days since last session — easing back in.`
    }
  }

  // Get suggested exercises with weights (batch-fetched, no N+1)
  // For Session C, use WOD generator with equipment filtering
  let suggestedExercises: ExerciseSuggestion[]
  let wod: SessionSuggestion['wod'] = undefined

  if (recommendedSession === 'C') {
    const wodResult = await generateWod(resolvedWeekType, runningLoad, loadFactor, isReEntry, equipment)
    suggestedExercises = wodResult.exercises
    wod = wodResult.wod
  } else {
    suggestedExercises = await getSuggestedExercises(
      recommendedSession,
      resolvedWeekType,
      runningLoad,
      loadFactor,
      isReEntry
    )
  }

  const lastSessionInfo = lastSession
    ? {
        type: lastSession.sessionType,
        date: lastSession.date.toISOString().split('T')[0],
        daysAgo: daysAgo!,
      }
    : null

  return {
    recommendedSession,
    rationale,
    weekType: resolvedWeekType,
    runningLoadLast7Days: runningLoad,
    runningContext: {
      acwr: runningLoadCtx.acwr,
      trend: runningLoadCtx.trend,
      weeklyLoad: runningLoadCtx.weeklyLoad,
      recommendation: runningLoadCtx.recommendation,
    },
    frequency: frequencyStats,
    lastSession: lastSessionInfo,
    suggestedExercises,
    wod,
  }
}

/**
 * Get exercise suggestions for a session type with weight recommendations.
 * Uses batch queries to avoid N+1.
 */
async function getSuggestedExercises(
  sessionType: string,
  weekType: WeekType,
  runningLoad: number,
  loadFactor: LoadFactor,
  isReEntry: boolean
): Promise<ExerciseSuggestion[]> {
  const template = SESSION_TEMPLATES[sessionType]
  if (!template) return []

  // Get exercises matching the session's movement patterns
  const exercises = await prisma.exercise.findMany({
    where: {
      movementPattern: { in: template.exercisePatterns },
    },
    take: 6,
  })

  if (exercises.length === 0) return []

  const exerciseIds = exercises.map(e => e.id)

  // BATCH FETCH: All history for all exercises in one query
  const allHistory = await prisma.sessionExercise.findMany({
    where: { exerciseId: { in: exerciseIds } },
    include: {
      sets: { orderBy: { setNumber: 'asc' } },
      session: { select: { date: true, weekType: true } },
    },
    orderBy: { session: { date: 'desc' } },
  })

  // Group history by exerciseId, taking only last 5 per exercise
  const historyByExercise = new Map<string, typeof allHistory>()
  for (const entry of allHistory) {
    const existing = historyByExercise.get(entry.exerciseId) || []
    if (existing.length < 5) {
      existing.push(entry)
      historyByExercise.set(entry.exerciseId, existing)
    }
  }

  const suggestions: ExerciseSuggestion[] = []

  for (const exercise of exercises) {
    const history = historyByExercise.get(exercise.id) || []

    const weightSuggestion = suggestWeightFromData(
      {
        history,
        runningLoad,
        loadFactor,
        category: exercise.category,
        movementPattern: exercise.movementPattern,
      },
      weekType
    )

    // If re-entry after gap, reduce suggested weight by one increment
    if (isReEntry && weightSuggestion.weight > 0) {
      const reEntryReduction = exercise.movementPattern &&
        ['hip_hinge', 'squat', 'hip_extension'].includes(exercise.movementPattern) ? 2.5 : 1.25
      weightSuggestion.weight = Math.max(0, weightSuggestion.weight - reEntryReduction)
      weightSuggestion.rationale = `Re-entry after gap: ${weightSuggestion.rationale}`
    }

    const lastWeight = history.length > 0
      ? history[0].sets.find(s => s.weight != null && s.weight > 0)?.weight ?? null
      : null

    suggestions.push({
      name: exercise.name,
      exerciseId: exercise.id,
      suggestedWeight: weightSuggestion.weight,
      suggestedSets: weightSuggestion.sets,
      suggestedReps: weightSuggestion.reps,
      confidence: weightSuggestion.confidence,
      lastWeight,
      rationale: weightSuggestion.rationale,
    })
  }

  return suggestions
}

/**
 * Generate a WOD (Workout of the Day) for Session C.
 * Filters exercises by available equipment and picks a random WOD format.
 */
async function generateWod(
  weekType: WeekType,
  runningLoad: number,
  loadFactor: LoadFactor,
  isReEntry: boolean,
  equipment?: string[]
): Promise<{ exercises: ExerciseSuggestion[]; wod: SessionSuggestion['wod'] }> {
  // Get conditioning + compound exercises, filtered by equipment if provided
  const where: Record<string, unknown> = {
    OR: [
      { category: 'conditioning' },
      { movementPattern: { in: ['compound', 'squat', 'hip_hinge', 'cardio'] } },
    ],
  }

  if (equipment && equipment.length > 0) {
    where.equipment = { hasSome: equipment }
  }

  const allExercises = await prisma.exercise.findMany({ where })

  // Shuffle and pick
  const shuffled = allExercises.sort(() => Math.random() - 0.5)

  // Pick a WOD template (bias toward shorter if high load or re-entry)
  let templates = [...WOD_TEMPLATES]
  if (loadFactor === 'high' || isReEntry) {
    templates = templates.filter(t => !t.duration || t.duration <= 16)
  }
  if (weekType === 'kid') {
    templates = templates.filter(t => !t.duration || t.duration <= 15)
  }
  const wodTemplate = templates[Math.floor(Math.random() * templates.length)]

  const picked = shuffled.slice(0, wodTemplate.slots)

  // Batch fetch history for picked exercises
  const exerciseIds = picked.map(e => e.id)
  const allHistory = await prisma.sessionExercise.findMany({
    where: { exerciseId: { in: exerciseIds } },
    include: {
      sets: { orderBy: { setNumber: 'asc' } },
      session: { select: { date: true, weekType: true } },
    },
    orderBy: { session: { date: 'desc' } },
  })

  const historyByExercise = new Map<string, typeof allHistory>()
  for (const entry of allHistory) {
    const existing = historyByExercise.get(entry.exerciseId) || []
    if (existing.length < 5) {
      existing.push(entry)
      historyByExercise.set(entry.exerciseId, existing)
    }
  }

  const exercises: ExerciseSuggestion[] = picked.map((exercise, i) => {
    const history = historyByExercise.get(exercise.id) || []

    const weightSuggestion = suggestWeightFromData(
      {
        history,
        runningLoad,
        loadFactor,
        category: exercise.category,
        movementPattern: exercise.movementPattern,
      },
      weekType
    )

    if (isReEntry && weightSuggestion.weight > 0) {
      weightSuggestion.weight = Math.max(0, weightSuggestion.weight - 2.5)
      weightSuggestion.rationale = `Re-entry: ${weightSuggestion.rationale}`
    }

    const lastWeight = history.length > 0
      ? history[0].sets.find(s => s.weight != null && s.weight > 0)?.weight ?? null
      : null

    return {
      name: exercise.name,
      exerciseId: exercise.id,
      suggestedWeight: weightSuggestion.weight,
      suggestedSets: wodTemplate.format === 'tabata' ? undefined : weightSuggestion.sets,
      suggestedReps: wodTemplate.defaultReps[i] || wodTemplate.defaultReps[0] || weightSuggestion.reps,
      confidence: weightSuggestion.confidence,
      lastWeight,
      rationale: weightSuggestion.rationale,
    }
  })

  return {
    exercises,
    wod: {
      name: wodTemplate.name,
      format: wodTemplate.format,
      duration: wodTemplate.duration,
      description: wodTemplate.description,
    },
  }
}

/**
 * Get frequency stats: sessions this week and this month
 */
async function getFrequencyStats(): Promise<{ thisWeek: number; thisMonth: number }> {
  const now = new Date()

  // Start of current week (Monday)
  const weekStart = new Date(now)
  const day = weekStart.getDay()
  const diff = day === 0 ? 6 : day - 1
  weekStart.setDate(weekStart.getDate() - diff)
  weekStart.setHours(0, 0, 0, 0)

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [thisWeek, thisMonth] = await Promise.all([
    prisma.gymSession.count({ where: { date: { gte: weekStart } } }),
    prisma.gymSession.count({ where: { date: { gte: monthStart } } }),
  ])

  return { thisWeek, thisMonth }
}
