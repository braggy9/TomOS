import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/life/habits/[id]
 * Get a single habit with recent logs (last 30 days)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const habit = await prisma.habit.findUnique({
      where: { id },
      include: {
        goal: { select: { id: true, title: true } },
        logs: {
          where: { date: { gte: thirtyDaysAgo } },
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!habit) {
      return NextResponse.json({ success: false, error: 'Habit not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: habit })
  } catch (error) {
    console.error('Error fetching habit:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch habit' }, { status: 500 })
  }
}

/**
 * PATCH /api/life/habits/[id]
 * Update a habit
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, frequency, customDays, category, icon, status, goalId } = body

    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (frequency !== undefined) data.frequency = frequency
    if (customDays !== undefined) data.customDays = customDays
    if (category !== undefined) data.category = category
    if (icon !== undefined) data.icon = icon
    if (status !== undefined) data.status = status
    if (goalId !== undefined) data.goalId = goalId || null

    const habit = await prisma.habit.update({
      where: { id },
      data,
      include: {
        goal: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ success: true, data: habit })
  } catch (error) {
    console.error('Error updating habit:', error)
    return NextResponse.json({ success: false, error: 'Failed to update habit' }, { status: 500 })
  }
}

/**
 * DELETE /api/life/habits/[id]
 * Archive a habit (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const habit = await prisma.habit.update({
      where: { id },
      data: { status: 'archived' },
    })

    return NextResponse.json({ success: true, data: habit })
  } catch (error) {
    console.error('Error archiving habit:', error)
    return NextResponse.json({ success: false, error: 'Failed to archive habit' }, { status: 500 })
  }
}
