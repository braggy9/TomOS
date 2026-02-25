import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionSuggestion } from '@/lib/fitness/suggestions'
import { getRunningLoadContext } from '@/lib/fitness/running-load'
import type { WeekType } from '@/types/fitness'

/**
 * GET /api/gym/daily-plan?weekType=non-kid&equipment=dumbbell,kettlebell
 * The "what should I do today" endpoint.
 * Combines session suggestion + recovery + running load + nutrition nudge.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const weekType = (searchParams.get('weekType') as WeekType) || undefined
    const equipmentParam = searchParams.get('equipment')
    const equipment = equipmentParam ? equipmentParam.split(',').map(s => s.trim()) : undefined

    // Fetch all context in parallel
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [suggestion, runningContext, todayRecovery, recentNutrition, weekSessions] =
      await Promise.all([
        getSessionSuggestion(weekType, equipment),
        getRunningLoadContext(),
        prisma.recoveryCheckIn.findFirst({
          where: { date: { gte: today, lt: tomorrow } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.nutritionLog.findMany({
          where: { date: { gte: sevenDaysAgo } },
          orderBy: { date: 'desc' },
        }),
        prisma.gymSession.count({
          where: { date: { gte: sevenDaysAgo } },
        }),
      ])

    const recoveryScore = todayRecovery?.readinessScore ?? null

    // Determine if they should train
    let shouldTrain = true
    const reasons: string[] = []

    if (recoveryScore !== null && recoveryScore < 2.5) {
      shouldTrain = false
      reasons.push('recovery score very low')
    }
    if (runningContext.acwr > 1.5) {
      shouldTrain = false
      reasons.push('ACWR spike detected')
    }
    if (weekSessions >= 4) {
      reasons.push('already trained 4+ times this week')
    }

    // Build nutrition nudge
    let nutritionNudge: string | null = null
    if (recentNutrition.length > 0) {
      const avgProtein = recentNutrition.reduce((s, l) => s + (l.proteinRating ?? 2), 0) / recentNutrition.length
      if (avgProtein < 2) {
        const isUpper = suggestion.recommendedSession === 'B'
        nutritionNudge = isUpper
          ? 'Hit protein hard today — upper body session.'
          : 'Protein has been low. Prioritize it today.'
      }
    }
    if (!nutritionNudge) {
      nutritionNudge = 'Nutrition on track.'
    }

    // Build headline
    const template = suggestion.recommendedSession
    const exercises = suggestion.suggestedExercises
      .slice(0, 3)
      .map(e => `${e.name} ${e.suggestedWeight}kg`)
      .join(', ')
    const headline = shouldTrain
      ? `Session ${template} today: ${exercises || 'check exercises'}`
      : `Rest day recommended: ${reasons.join(', ')}`

    // Build context string
    const resolvedWeekType = weekType || 'non-kid'
    const contextParts = [
      resolvedWeekType === 'kid' ? 'Kid week' : 'Non-kid week',
      `${weekSessions} session${weekSessions === 1 ? '' : 's'} this week`,
      `Running load ${runningContext.loadFactor}`,
    ]

    return NextResponse.json({
      success: true,
      data: {
        headline,
        shouldTrain,
        suggestion,
        recoveryScore,
        nutritionNudge,
        runningContext,
        context: contextParts.join(', '),
      },
    })
  } catch (error) {
    console.error('Error generating daily plan:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate plan' }, { status: 500 })
  }
}
