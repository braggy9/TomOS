import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

/**
 * POST /api/gym/running/sessions
 * Create or update a RunSession (subjective data for a run)
 * Auto-attaches today's RecoveryCheckIn if available
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { runningSyncId, rpe, moodPost, sessionTypeOverride, notes } = body

    if (!runningSyncId) {
      return NextResponse.json(
        { success: false, error: 'runningSyncId is required' },
        { status: 400 }
      )
    }

    // Verify the running sync exists
    const runningSync = await prisma.runningSync.findUnique({
      where: { id: runningSyncId },
    })

    if (!runningSync) {
      return NextResponse.json(
        { success: false, error: 'Running activity not found' },
        { status: 404 }
      )
    }

    // Auto-find today's recovery check-in (Sydney timezone)
    const { startOfDay, endOfDay } = getSydneyToday()

    const todayRecovery = await prisma.recoveryCheckIn.findFirst({
      where: { date: { gte: startOfDay, lte: endOfDay } },
      orderBy: { date: 'desc' },
    })

    // Upsert the run session
    const session = await prisma.runSession.upsert({
      where: { runningSyncId },
      create: {
        runningSyncId,
        rpe: rpe ?? null,
        moodPost: moodPost ?? null,
        sessionTypeOverride: sessionTypeOverride ?? null,
        notes: notes ?? null,
        recoveryId: todayRecovery?.id ?? null,
      },
      update: {
        rpe: rpe ?? null,
        moodPost: moodPost ?? null,
        sessionTypeOverride: sessionTypeOverride ?? null,
        notes: notes ?? null,
        recoveryId: todayRecovery?.id ?? null,
      },
    })

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Error creating run session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create run session' },
      { status: 500 }
    )
  }
}
