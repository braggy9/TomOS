import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'
import { getStravaAccessToken } from '@/lib/fitness/strava-auth'

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

    // Fire-and-forget: push RPE/notes back to Strava activity description
    if (runningSync.externalId) {
      syncToStrava(runningSync.externalId, { rpe, moodPost, sessionTypeOverride, notes }).catch(err =>
        console.error('Strava writeback error:', err)
      )
    }

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Error creating run session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create run session' },
      { status: 500 }
    )
  }
}

const MOOD_LABELS: Record<number, string> = { 1: '😫', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' }

async function syncToStrava(
  stravaActivityId: string,
  data: { rpe?: number; moodPost?: number; sessionTypeOverride?: string; notes?: string }
) {
  const token = await getStravaAccessToken()
  if (!token) return

  // Build a compact summary line to prepend to the description
  const parts: string[] = []
  if (data.rpe) parts.push(`RPE ${data.rpe}/10`)
  if (data.moodPost) parts.push(`Mood ${MOOD_LABELS[data.moodPost] || data.moodPost}`)
  if (data.sessionTypeOverride) parts.push(`Type: ${data.sessionTypeOverride}`)
  if (parts.length === 0 && !data.notes) return

  const summary = parts.length > 0 ? `[${parts.join(' · ')}]` : ''
  const description = [summary, data.notes].filter(Boolean).join('\n')

  const res = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava PUT ${res.status}: ${text}`)
  }
}
