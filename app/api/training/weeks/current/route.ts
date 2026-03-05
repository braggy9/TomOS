import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/training/weeks/current
 * Get the current training week (by date) with all planned sessions.
 */
export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find the current week: startDate <= today, within an active block
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
            linkedRun: { select: { id: true, date: true, distance: true, type: true, duration: true } },
            linkedGymSession: { select: { id: true, date: true, sessionType: true, duration: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    if (!currentWeek) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No active training week found',
      })
    }

    // Calculate week progress
    const planned = currentWeek.sessions.length
    const completed = currentWeek.sessions.filter(
      s => s.status === 'completed' || s.status === 'minimum_dose'
    ).length
    const skipped = currentWeek.sessions.filter(s => s.status === 'skipped').length

    return NextResponse.json({
      success: true,
      data: {
        ...currentWeek,
        weekProgress: {
          planned,
          completed,
          skipped,
          targetKm: currentWeek.targetKm,
          actualKm: currentWeek.actualKm,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching current week:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch current week' }, { status: 500 })
  }
}
