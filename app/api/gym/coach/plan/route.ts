import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

/**
 * GET /api/gym/coach/plan
 * Current training plan context — active block, current week, sessions with completion status.
 */
export async function GET() {
  try {
    const { endOfDay: sydneyDate } = getSydneyToday()

    // Find active block
    const activeBlock = await prisma.trainingBlock.findFirst({
      where: { status: 'active' },
      orderBy: { startDate: 'desc' },
    })

    if (!activeBlock) {
      return NextResponse.json({
        success: true,
        data: {
          hasActivePlan: false,
          block: null,
          week: null,
          weekProgress: null,
        },
      })
    }

    // Current week within the active block
    const currentWeek = await prisma.trainingWeek.findFirst({
      where: {
        blockId: activeBlock.id,
        startDate: { lte: sydneyDate },
      },
      include: {
        sessions: {
          orderBy: { dayOfWeek: 'asc' },
          include: {
            linkedRun: { select: { id: true, distance: true, avgPace: true, type: true } },
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
          hasActivePlan: true,
          block: {
            name: activeBlock.name,
            phase: activeBlock.phase,
            startDate: activeBlock.startDate,
            endDate: activeBlock.endDate,
            targetWeeklyKm: activeBlock.targetWeeklyKm,
            status: activeBlock.status,
          },
          week: null,
          weekProgress: null,
        },
      })
    }

    // Filter sessions by week type
    const applicableSessions = currentWeek.sessions.filter(s => {
      if (currentWeek.weekType === 'kid') return !s.isNonKidOnly
      if (currentWeek.weekType === 'non-kid') return !s.isKidWeekOnly
      return true
    })

    const completed = applicableSessions.filter(
      s => s.status === 'completed' || s.status === 'minimum_dose'
    ).length
    const skipped = applicableSessions.filter(s => s.status === 'skipped').length

    // Actual km from linked runs
    const actualKm = applicableSessions.reduce((sum, s) => {
      if (s.linkedRun) return sum + s.linkedRun.distance
      return sum
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        hasActivePlan: true,
        block: {
          name: activeBlock.name,
          phase: activeBlock.phase,
          startDate: activeBlock.startDate,
          endDate: activeBlock.endDate,
          targetWeeklyKm: activeBlock.targetWeeklyKm,
          status: activeBlock.status,
        },
        week: {
          weekNumber: currentWeek.weekNumber,
          startDate: currentWeek.startDate,
          targetKm: currentWeek.targetKm,
          actualKm: Math.round(actualKm * 10) / 10,
          keyFocus: currentWeek.keyFocus,
          weekType: currentWeek.weekType,
          sessions: applicableSessions.map(s => ({
            dayOfWeek: s.dayOfWeek,
            sessionType: s.sessionType,
            sessionName: s.sessionName,
            targetDistanceKm: s.targetDistanceKm,
            targetPaceZone: s.targetPaceZone,
            notes: s.notes,
            isOptional: s.isOptional,
            status: s.status,
            linkedRun: s.linkedRun
              ? {
                  distance: Math.round(s.linkedRun.distance * 10) / 10,
                  avgPace: s.linkedRun.avgPace,
                  type: s.linkedRun.type,
                }
              : null,
          })),
        },
        weekProgress: {
          planned: applicableSessions.length,
          completed,
          skipped,
          targetKm: currentWeek.targetKm,
          actualKm: Math.round(actualKm * 10) / 10,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching coach plan:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch training plan' }, { status: 500 })
  }
}
