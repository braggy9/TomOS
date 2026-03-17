import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/habits
 * List habits with optional filtering
 * Query params: status, category, goalId, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const goalId = searchParams.get('goalId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) where.status = status
    if (category) where.category = category
    if (goalId) where.goalId = goalId

    const [habits, total] = await Promise.all([
      prisma.habit.findMany({
        where,
        include: {
          goal: { select: { id: true, title: true } },
          logs: {
            orderBy: { date: 'desc' },
            take: 7,
          },
        },
        orderBy: [{ status: 'asc' }, { streakCurrent: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.habit.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: habits,
      pagination: { total, limit, offset, hasMore: offset + habits.length < total },
    })
  } catch (error) {
    console.error('Error fetching habits:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch habits' }, { status: 500 })
  }
}

/**
 * POST /api/life/habits
 * Create a new habit
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, frequency, customDays, category, icon, goalId } = body

    if (!title || !frequency) {
      return NextResponse.json(
        { success: false, error: 'title and frequency are required' },
        { status: 400 }
      )
    }

    if (frequency === 'custom' && (!customDays || !customDays.length)) {
      return NextResponse.json(
        { success: false, error: 'customDays required when frequency is custom' },
        { status: 400 }
      )
    }

    const habit = await prisma.habit.create({
      data: {
        title,
        description: description || null,
        frequency,
        customDays: customDays || [],
        category: category || null,
        icon: icon || null,
        goalId: goalId || null,
      },
      include: {
        goal: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ success: true, data: habit }, { status: 201 })
  } catch (error) {
    console.error('Error creating habit:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create habit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
