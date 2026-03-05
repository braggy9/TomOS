import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/training/today
 * "What should I do today?" — returns today's planned session with block/week context.
 */
export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // dayOfWeek: 1=Mon ... 7=Sun (JS getDay: 0=Sun, 1=Mon...)
    const jsDay = today.getDay()
    const todayDayOfWeek = jsDay === 0 ? 7 : jsDay

    // Find the current week within an active block
    const currentWeek = await prisma.trainingWeek.findFirst({
      where: {
        startDate: { lte: today },
        block: { status: 'active' },
      },
      include: {
        block: true,
        sessions: {
          orderBy: { dayOfWeek: 'asc' },
          include: {
            linkedRun: { select: { id: true, distance: true, type: true } },
            linkedGymSession: { select: { id: true, sessionType: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    if (!currentWeek) {
      return NextResponse.json({
        success: true,
        data: {
          hasActivePlan: false,
          message: 'No active training plan. Use the suggestion engine for ad-hoc sessions.',
        },
      })
    }

    // Find today's planned session(s)
    let todaysSessions = currentWeek.sessions.filter(
      s => s.dayOfWeek === todayDayOfWeek && s.status === 'planned'
    )

    // Filter by week type if set
    if (currentWeek.weekType === 'kid') {
      todaysSessions = todaysSessions.filter(s => !s.isNonKidOnly)
    } else if (currentWeek.weekType === 'non-kid') {
      todaysSessions = todaysSessions.filter(s => !s.isKidWeekOnly)
    }

    // Week progress
    const allApplicable = currentWeek.sessions.filter(s => {
      if (currentWeek.weekType === 'kid') return !s.isNonKidOnly
      if (currentWeek.weekType === 'non-kid') return !s.isKidWeekOnly
      return true
    })
    const completed = allApplicable.filter(
      s => s.status === 'completed' || s.status === 'minimum_dose'
    ).length

    return NextResponse.json({
      success: true,
      data: {
        hasActivePlan: true,
        block: {
          name: currentWeek.block.name,
          phase: currentWeek.block.phase,
        },
        week: {
          id: currentWeek.id,
          weekNumber: currentWeek.weekNumber,
          weekType: currentWeek.weekType,
          keyFocus: currentWeek.keyFocus,
          targetKm: currentWeek.targetKm,
          actualKm: currentWeek.actualKm,
        },
        todaysSessions: todaysSessions.map(s => ({
          id: s.id,
          sessionType: s.sessionType,
          sessionName: s.sessionName,
          targetDistanceKm: s.targetDistanceKm,
          targetPaceZone: s.targetPaceZone,
          notes: s.notes,
          isOptional: s.isOptional,
          status: s.status,
        })),
        weekProgress: {
          planned: allApplicable.length,
          completed,
          targetKm: currentWeek.targetKm,
          actualKm: currentWeek.actualKm,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching today\'s training plan:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch today\'s plan' }, { status: 500 })
  }
}
