import { prisma } from '@/lib/prisma'
import { getWeeklyRunningLoad, classifyLoad } from './running-load'
import { suggestWeight } from './progressive-overload'
import type { SessionSuggestion, WeekType, ExerciseSuggestion } from '@/types/fitness'

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
    name: 'CrossFit Fun',
    day: 'Sunday',
    exercisePatterns: ['compound', 'squat', 'hip_hinge', 'cardio'],
  },
}

/**
 * Recommend which session to do next, with exercise-level weight suggestions
 */
export async function getSessionSuggestion(
  weekType?: WeekType
): Promise<SessionSuggestion> {
  // Get last session
  const lastSession = await prisma.gymSession.findFirst({
    orderBy: { date: 'desc' },
    select: { sessionType: true, date: true },
  })

  // Get running load
  const runningLoad = await getWeeklyRunningLoad()
  const loadFactor = classifyLoad(runningLoad)

  // Determine week type
  const resolvedWeekType: WeekType = weekType || 'non-kid'

  // Determine which session to recommend
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  let recommendedSession = 'A'
  let rationale = ''

  if (lastSession) {
    const daysAgo = Math.floor(
      (today.getTime() - lastSession.date.getTime()) / (1000 * 60 * 60 * 24)
    )
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
  }

  // Get suggested exercises with weights
  const suggestedExercises = await getSuggestedExercises(recommendedSession, resolvedWeekType)

  const lastSessionInfo = lastSession
    ? {
        type: lastSession.sessionType,
        date: lastSession.date.toISOString().split('T')[0],
        daysAgo: Math.floor(
          (today.getTime() - lastSession.date.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }
    : null

  return {
    recommendedSession,
    rationale,
    weekType: resolvedWeekType,
    runningLoadLast7Days: runningLoad,
    lastSession: lastSessionInfo,
    suggestedExercises,
  }
}

/**
 * Get exercise suggestions for a session type with weight recommendations
 */
async function getSuggestedExercises(
  sessionType: string,
  weekType: WeekType
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

  const suggestions: ExerciseSuggestion[] = []

  for (const exercise of exercises) {
    const weightSuggestion = await suggestWeight(exercise.id, weekType)

    // Get the last weight used for this exercise
    const lastSessionExercise = await prisma.sessionExercise.findFirst({
      where: { exerciseId: exercise.id },
      include: { sets: { orderBy: { setNumber: 'asc' }, take: 1 } },
      orderBy: { session: { date: 'desc' } },
    })

    const lastWeight = lastSessionExercise?.sets[0]?.weight ?? null

    suggestions.push({
      name: exercise.name,
      exerciseId: exercise.id,
      suggestedWeight: weightSuggestion.weight,
      lastWeight,
      rationale: weightSuggestion.rationale,
    })
  }

  return suggestions
}
