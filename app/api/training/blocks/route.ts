import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/training/blocks?status=active
 * List all training blocks, optionally filtered by status.
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const blocks = await prisma.trainingBlock.findMany({
      where,
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' },
          select: {
            id: true,
            weekNumber: true,
            startDate: true,
            targetKm: true,
            actualKm: true,
            status: true,
            weekType: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    })

    return NextResponse.json({ success: true, data: blocks })
  } catch (error) {
    console.error('Error fetching training blocks:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch blocks' }, { status: 500 })
  }
}

/**
 * POST /api/training/blocks
 * Create a new training block.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phase, startDate, endDate, targetWeeklyKm, notes, status } = body

    if (!name || !phase || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'name, phase, startDate, endDate are required' },
        { status: 400 }
      )
    }

    const block = await prisma.trainingBlock.create({
      data: {
        name,
        phase,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targetWeeklyKm: targetWeeklyKm ?? null,
        notes: notes ?? null,
        status: status ?? 'planned',
      },
    })

    return NextResponse.json({ success: true, data: block }, { status: 201 })
  } catch (error) {
    console.error('Error creating training block:', error)
    return NextResponse.json({ success: false, error: 'Failed to create block' }, { status: 500 })
  }
}
