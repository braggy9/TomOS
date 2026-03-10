import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const plannedSessionSchema = z.object({
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

const createWeekSchema = z.object({
  blockId: z.string().uuid(),
  weekNumber: z.number().int().min(1),
  startDate: z.string(), // YYYY-MM-DD (Monday)
  targetKm: z.number().min(0).optional(),
  keyFocus: z.string().optional(),
  weekType: z.enum(['kid', 'non-kid']).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  sessions: z.array(plannedSessionSchema).optional(),
})

/**
 * POST /api/training/weeks
 * Create a training week with optional nested planned sessions.
 * Used by the Claude training chat to dynamically generate weekly plans.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createWeekSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { blockId, weekNumber, startDate, targetKm, keyFocus, weekType, notes, status, sessions } = parsed.data

    // Verify block exists
    const block = await prisma.trainingBlock.findUnique({ where: { id: blockId } })
    if (!block) {
      return NextResponse.json({ success: false, error: 'Block not found' }, { status: 404 })
    }

    // Create week + sessions in a transaction
    const week = await prisma.$transaction(async (tx) => {
      const newWeek = await tx.trainingWeek.create({
        data: {
          blockId,
          weekNumber,
          startDate: new Date(startDate + 'T00:00:00Z'),
          targetKm: targetKm ?? null,
          keyFocus: keyFocus ?? null,
          weekType: weekType ?? null,
          notes: notes ?? null,
          status: status ?? 'planned',
        },
      })

      if (sessions && sessions.length > 0) {
        await tx.plannedSession.createMany({
          data: sessions.map((s) => ({
            weekId: newWeek.id,
            dayOfWeek: s.dayOfWeek,
            sessionType: s.sessionType,
            targetDistanceKm: s.targetDistanceKm ?? null,
            targetPaceZone: s.targetPaceZone ?? null,
            sessionName: s.sessionName ?? null,
            notes: s.notes ?? null,
            isOptional: s.isOptional ?? false,
            isKidWeekOnly: s.isKidWeekOnly ?? false,
            isNonKidOnly: s.isNonKidOnly ?? false,
          })),
        })
      }

      return tx.trainingWeek.findUnique({
        where: { id: newWeek.id },
        include: {
          block: { select: { name: true, phase: true } },
          sessions: { orderBy: { dayOfWeek: 'asc' } },
        },
      })
    })

    return NextResponse.json({ success: true, data: week }, { status: 201 })
  } catch (error) {
    console.error('Error creating training week:', error)
    return NextResponse.json({ success: false, error: 'Failed to create week' }, { status: 500 })
  }
}
