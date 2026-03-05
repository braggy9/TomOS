import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/training/blocks/[id]
 * Get a single block with all weeks and sessions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const block = await prisma.trainingBlock.findUnique({
      where: { id: params.id },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' },
          include: {
            sessions: {
              orderBy: { dayOfWeek: 'asc' },
              include: {
                linkedRun: { select: { id: true, date: true, distance: true, type: true } },
                linkedGymSession: { select: { id: true, date: true, sessionType: true } },
              },
            },
          },
        },
      },
    })

    if (!block) {
      return NextResponse.json({ success: false, error: 'Block not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: block })
  } catch (error) {
    console.error('Error fetching training block:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch block' }, { status: 500 })
  }
}

/**
 * PATCH /api/training/blocks/[id]
 * Update block status, dates, notes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, phase, startDate, endDate, targetWeeklyKm, notes, status } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phase !== undefined) data.phase = phase
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = new Date(endDate)
    if (targetWeeklyKm !== undefined) data.targetWeeklyKm = targetWeeklyKm
    if (notes !== undefined) data.notes = notes
    if (status !== undefined) data.status = status

    const block = await prisma.trainingBlock.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ success: true, data: block })
  } catch (error) {
    console.error('Error updating training block:', error)
    return NextResponse.json({ success: false, error: 'Failed to update block' }, { status: 500 })
  }
}
