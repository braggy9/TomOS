import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { completeGymTask } from '@/lib/fitness/task-sync'

/**
 * GET /api/gym/sessions/[id]
 * Get a single gym session with all exercises and sets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const session = await prisma.gymSession.findUnique({
      where: { id },
      include: {
        sessionExercises: {
          include: {
            exercise: true,
            sets: { orderBy: { setNumber: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
        task: { select: { id: true, title: true, status: true } },
      },
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: session })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/gym/sessions/[id]
 * Update a gym session
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.gymSession.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (body.sessionType !== undefined) updateData.sessionType = body.sessionType
    if (body.date !== undefined) updateData.date = new Date(body.date)
    if (body.duration !== undefined) updateData.duration = body.duration
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.overallRPE !== undefined) updateData.overallRPE = body.overallRPE
    if (body.weekType !== undefined) updateData.weekType = body.weekType
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null

    const session = await prisma.gymSession.update({
      where: { id },
      data: updateData,
      include: {
        sessionExercises: {
          include: {
            exercise: true,
            sets: { orderBy: { setNumber: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    // Fire-and-forget: complete linked task when session is marked completed
    if (body.completedAt && existing.taskId && !existing.completedAt) {
      completeGymTask(existing.taskId).catch(() => {})
    }

    return NextResponse.json({ success: true, data: session })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gym/sessions/[id]
 * Delete a gym session and all related data (cascades)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.gymSession.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    await prisma.gymSession.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Session deleted' })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
