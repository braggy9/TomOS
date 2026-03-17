import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/goals
 * List goals with optional filtering
 * Query params: status, category, timeframe, parentId, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const timeframe = searchParams.get('timeframe')
    const parentId = searchParams.get('parentId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) where.status = status
    if (category) where.category = category
    if (timeframe) where.timeframe = timeframe
    if (parentId === 'null') {
      where.parentId = null // top-level goals only
    } else if (parentId) {
      where.parentId = parentId
    }

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where,
        include: {
          children: { select: { id: true, title: true, status: true, progress: true } },
          habits: { select: { id: true, title: true, status: true, streakCurrent: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.goal.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: goals,
      pagination: { total, limit, offset, hasMore: offset + goals.length < total },
    })
  } catch (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch goals' }, { status: 500 })
  }
}

/**
 * POST /api/life/goals
 * Create a new goal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, category, timeframe, targetDate, parentId, status } = body

    if (!title || !category || !timeframe) {
      return NextResponse.json(
        { success: false, error: 'title, category, and timeframe are required' },
        { status: 400 }
      )
    }

    const goal = await prisma.goal.create({
      data: {
        title,
        description: description || null,
        category,
        timeframe,
        status: status || 'active',
        targetDate: targetDate ? new Date(targetDate) : null,
        parentId: parentId || null,
      },
      include: {
        children: true,
        habits: true,
      },
    })

    return NextResponse.json({ success: true, data: goal }, { status: 201 })
  } catch (error) {
    console.error('Error creating goal:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create goal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
