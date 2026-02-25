import { NextRequest, NextResponse } from 'next/server'
import { getSessionSuggestion } from '@/lib/fitness/suggestions'
import { prisma } from '@/lib/prisma'

const SESSION_NAMES: Record<string, string> = {
  A: 'Strength + Power',
  B: 'Upper + Core',
  C: 'CrossFit Fun',
}

// Gym days: Tuesday (2), Friday (5), Sunday (0 non-kid only)
const GYM_DAYS_NON_KID = [0, 2, 5]
const GYM_DAYS_KID = [2, 5]

/**
 * GET /api/cron/gym-suggestion
 * Called by cron each morning — sends gym session push notification on gym days
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get current day in Sydney
    const sydneyNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })
    )
    const dayOfWeek = sydneyNow.getDay()

    // Determine week type from most recent session's weekType, or default to non-kid
    const lastSession = await prisma.gymSession.findFirst({
      orderBy: { date: 'desc' },
      select: { weekType: true },
    })
    const weekType = (lastSession?.weekType as 'kid' | 'non-kid') || 'non-kid'

    const gymDays = weekType === 'kid' ? GYM_DAYS_KID : GYM_DAYS_NON_KID
    if (!gymDays.includes(dayOfWeek)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Not a gym day (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}, ${weekType} week)`,
      })
    }

    // Get session suggestion
    const suggestion = await getSessionSuggestion(weekType)
    const sessionName = SESSION_NAMES[suggestion.recommendedSession] || `Session ${suggestion.recommendedSession}`

    // Build push notification body
    const exerciseLines = suggestion.suggestedExercises
      .filter(e => e.suggestedWeight > 0)
      .slice(0, 4)
      .map(e => `${e.name} ${e.suggestedWeight}kg`)
      .join(', ')

    const body = exerciseLines
      ? `${sessionName}: ${exerciseLines}`
      : `${sessionName} — check the app for details`

    // Check today's recovery
    const sydneyDate = new Date(
      new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    )
    const recovery = await prisma.recoveryCheckIn.findFirst({
      where: { date: { gte: sydneyDate } },
      orderBy: { date: 'desc' },
    })

    let recoveryNote = ''
    if (recovery) {
      if (recovery.soreness <= 2 || recovery.sleepQuality <= 2) {
        recoveryNote = ' (take it easy today)'
      }
    }

    // Send push notification
    const pushUrl = 'https://tomos-task-api.vercel.app/api/send-push'
    const pushRes = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Gym Day: Session ${suggestion.recommendedSession}${recoveryNote}`,
        body,
        badge: 1,
      }),
    })

    const pushResult = await pushRes.json()

    return NextResponse.json({
      success: true,
      suggestion: {
        session: suggestion.recommendedSession,
        sessionName,
        weekType,
        exerciseCount: suggestion.suggestedExercises.length,
      },
      pushSent: pushResult,
    })
  } catch (error) {
    console.error('Error in gym suggestion cron:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate gym suggestion' },
      { status: 500 }
    )
  }
}
