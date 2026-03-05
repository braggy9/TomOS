import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/training/weeks/[id]/reconcile
 * Match completed runs/sessions to planned sessions for the week.
 * Also updates actualKm from RunningSync data.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const week = await prisma.trainingWeek.findUnique({
      where: { id: params.id },
      include: { sessions: true },
    })

    if (!week) {
      return NextResponse.json({ success: false, error: 'Week not found' }, { status: 404 })
    }

    // Get the date range for this week (Mon-Sun)
    const weekStart = new Date(week.startDate)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    // Fetch all runs and gym sessions in this date range
    const [runs, gymSessions] = await Promise.all([
      prisma.runningSync.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        orderBy: { date: 'asc' },
      }),
      prisma.gymSession.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        orderBy: { date: 'asc' },
      }),
    ])

    let matched = 0

    // Match unlinked planned sessions to actual activities
    const unmatchedPlanned = week.sessions.filter(
      s => s.status === 'planned' && !s.linkedRunId && !s.linkedGymSessionId
    )

    for (const planned of unmatchedPlanned) {
      // For running sessions, match by day of week
      if (['easy', 'long', 'tempo', 'intervals', 'hills', 'time_trial', 'progressive'].includes(planned.sessionType)) {
        const matchingRun = runs.find(r => {
          const runDay = r.date.getDay() === 0 ? 7 : r.date.getDay()
          return runDay === planned.dayOfWeek && !week.sessions.some(s => s.linkedRunId === r.id)
        })

        if (matchingRun) {
          await prisma.plannedSession.update({
            where: { id: planned.id },
            data: { linkedRunId: matchingRun.id, status: 'completed' },
          })
          matched++
        }
      }

      // For gym sessions (BFT/metcon), match by day of week
      if (['bft', 'metcon'].includes(planned.sessionType)) {
        const matchingGym = gymSessions.find(g => {
          const gymDay = g.date.getDay() === 0 ? 7 : g.date.getDay()
          return gymDay === planned.dayOfWeek && !week.sessions.some(s => s.linkedGymSessionId === g.id)
        })

        if (matchingGym) {
          await prisma.plannedSession.update({
            where: { id: planned.id },
            data: { linkedGymSessionId: matchingGym.id, status: 'completed' },
          })
          matched++
        }
      }
    }

    // Update actualKm from all runs in the week
    const totalKm = runs.reduce((sum, r) => sum + r.distance, 0)
    await prisma.trainingWeek.update({
      where: { id: params.id },
      data: { actualKm: Math.round(totalKm * 10) / 10 },
    })

    return NextResponse.json({
      success: true,
      data: {
        matched,
        totalRuns: runs.length,
        totalGymSessions: gymSessions.length,
        actualKm: Math.round(totalKm * 10) / 10,
      },
    })
  } catch (error) {
    console.error('Error reconciling week:', error)
    return NextResponse.json({ success: false, error: 'Failed to reconcile week' }, { status: 500 })
  }
}
