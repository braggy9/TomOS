import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const createSessionSchema = z.object({
  weekId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  sessionType: z.string(),
  targetDistanceKm: z.number().min(0).optional(),
  targetPaceZone: z.string().optional(),
  sessionName: z.string().optional(),
  notes: z.string().optional(),
  isOptional: z.boolean().optional(),
  isKidWeekOnly: z.boolean().optional(),
  isNonKidOnly: z.boolean().optional(),
})

/**
 * POST /api/training/sessions
 * Create an individual planned session within a training week.
 * Used by the Claude training chat to add sessions to existing weeks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { weekId, ...data } = parsed.data

    // Verify week exists
    const week = await prisma.trainingWeek.findUnique({ where: { id: weekId } })
    if (!week) {
      return NextResponse.json({ success: false, error: 'Week not found' }, { status: 404 })
    }

    const session = await prisma.plannedSession.create({
      data: {
        weekId,
        dayOfWeek: data.dayOfWeek,
        sessionType: data.sessionType,
        targetDistanceKm: data.targetDistanceKm ?? null,
        targetPaceZone: data.targetPaceZone ?? null,
        sessionName: data.sessionName ?? null,
        notes: data.notes ?? null,
        isOptional: data.isOptional ?? false,
        isKidWeekOnly: data.isKidWeekOnly ?? false,
        isNonKidOnly: data.isNonKidOnly ?? false,
      },
      include: {
        week: { select: { id: true, weekNumber: true, blockId: true } },
      },
    })

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Error creating planned session:', error)
    return NextResponse.json({ success: false, error: 'Failed to create session' }, { status: 500 })
  }
}
