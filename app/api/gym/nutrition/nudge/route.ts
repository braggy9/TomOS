import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/gym/nutrition/nudge — Contextual nutrition nudge
 * Based on recent nutrition logs and today's planned session
 */
export async function GET() {
  try {
    // Get last 7 days of nutrition logs
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentLogs = await prisma.nutritionLog.findMany({
      where: { date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    })

    // Get today's session suggestion context
    const lastSession = await prisma.gymSession.findFirst({
      orderBy: { date: 'desc' },
      select: { sessionType: true },
    })

    let nudge: string
    const isUpperDay = lastSession?.sessionType === 'A'
      ? false // A = lower body focus
      : true

    if (recentLogs.length === 0) {
      nudge = 'Start tracking nutrition — even a quick protein/hydration check helps.'
    } else {
      const avgProtein = recentLogs.reduce((sum, l) => sum + (l.proteinRating ?? 2), 0) / recentLogs.length
      const avgHydration = recentLogs.reduce((sum, l) => sum + (l.hydrationRating ?? 2), 0) / recentLogs.length

      if (avgProtein < 2) {
        nudge = isUpperDay
          ? 'Hit protein hard today — upper body session needs it for recovery.'
          : 'Protein has been low this week. Prioritize it today for leg recovery.'
      } else if (avgHydration < 2) {
        nudge = 'Hydration has been low — aim for 2L+ before training.'
      } else if (avgProtein >= 2.5 && avgHydration >= 2.5) {
        nudge = 'Nutrition on point this week. Keep it up.'
      } else {
        nudge = 'Nutrition is okay. Try to hit protein and hydration targets today.'
      }
    }

    return NextResponse.json({ success: true, data: { nudge } })
  } catch (error) {
    console.error('Error generating nutrition nudge:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate nudge' }, { status: 500 })
  }
}
