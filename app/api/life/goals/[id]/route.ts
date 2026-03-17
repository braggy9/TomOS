import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/life/goals/[id]
 * Get a single goal with children and linked habits
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        children: {
          include: {
            habits: { select: { id: true, title: true, status: true, streakCurrent: true } },
          },
        },
        habits: {
          include: {
            logs: {
              orderBy: { date: 'desc' },
              take: 7,
            },
          },
        },
        parent: { select: { id: true, title: true } },
      },
    })

    if (!goal) {
      return NextResponse.json({ success: false, error: 'Goal not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: goal })
  } catch (error) {
    console.error('Error fetching goal:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch goal' }, { status: 500 })
  }
}

/**
 * PATCH /api/life/goals/[id]
 * Update a goal
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, category, timeframe, status, progress, targetDate, parentId } = body

    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (category !== undefined) data.category = category
    if (timeframe !== undefined) data.timeframe = timeframe
    if (status !== undefined) data.status = status
    if (progress !== undefined) data.progress = Math.min(100, Math.max(0, progress))
    if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null
    if (parentId !== undefined) data.parentId = parentId || null

    // Auto-set completedAt when status changes to completed
    if (status === 'completed') data.completedAt = new Date()
    if (status === 'active' || status === 'paused') data.completedAt = null

    const goal = await prisma.goal.update({
      where: { id },
      data,
      include: {
        children: true,
        habits: true,
      },
    })

    return NextResponse.json({ success: true, data: goal })
  } catch (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json({ success: false, error: 'Failed to update goal' }, { status: 500 })
  }
}

/**
 * DELETE /api/life/goals/[id]
 * Soft archive a goal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const goal = await prisma.goal.update({
      where: { id },
      data: { status: 'abandoned' },
    })

    return NextResponse.json({ success: true, data: goal })
  } catch (error) {
    console.error('Error archiving goal:', error)
    return NextResponse.json({ success: false, error: 'Failed to archive goal' }, { status: 500 })
  }
}
