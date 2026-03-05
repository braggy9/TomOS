import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/training/weeks/[id]
 * Update week: weekType, notes, actualKm, status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { weekType, notes, actualKm, status, keyFocus } = body

    const data: Record<string, unknown> = {}
    if (weekType !== undefined) data.weekType = weekType
    if (notes !== undefined) data.notes = notes
    if (actualKm !== undefined) data.actualKm = actualKm
    if (status !== undefined) data.status = status
    if (keyFocus !== undefined) data.keyFocus = keyFocus

    const week = await prisma.trainingWeek.update({
      where: { id: params.id },
      data,
      include: {
        block: { select: { name: true, phase: true } },
        sessions: { orderBy: { dayOfWeek: 'asc' } },
      },
    })

    return NextResponse.json({ success: true, data: week })
  } catch (error) {
    console.error('Error updating training week:', error)
    return NextResponse.json({ success: false, error: 'Failed to update week' }, { status: 500 })
  }
}
