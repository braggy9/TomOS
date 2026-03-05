import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/training/sessions/[id]
 * Update a planned session: status, link to actual run/gym session.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, linkedRunId, linkedGymSessionId, notes, sessionName } = body

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (linkedRunId !== undefined) data.linkedRunId = linkedRunId
    if (linkedGymSessionId !== undefined) data.linkedGymSessionId = linkedGymSessionId
    if (notes !== undefined) data.notes = notes
    if (sessionName !== undefined) data.sessionName = sessionName

    const session = await prisma.plannedSession.update({
      where: { id: params.id },
      data,
      include: {
        week: { select: { id: true, weekNumber: true, blockId: true } },
        linkedRun: { select: { id: true, date: true, distance: true, type: true } },
        linkedGymSession: { select: { id: true, date: true, sessionType: true } },
      },
    })

    return NextResponse.json({ success: true, data: session })
  } catch (error) {
    console.error('Error updating planned session:', error)
    return NextResponse.json({ success: false, error: 'Failed to update session' }, { status: 500 })
  }
}
