import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/plans
 * List weekly plans with optional filtering
 * Query params: status, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) where.status = status

    const [plans, total] = await Promise.all([
      prisma.weeklyPlan.findMany({
        where,
        orderBy: { weekStart: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.weeklyPlan.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: plans,
      pagination: { total, limit, offset, hasMore: offset + plans.length < total },
    })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch plans' }, { status: 500 })
  }
}

/**
 * POST /api/life/plans
 * Create a weekly plan for a specific week
 * Body: { weekStart: string (ISO date of Monday), energyLevel?, kidWeek?, priorities?, intentions? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStart, energyLevel, kidWeek, priorities, intentions, status } = body

    if (!weekStart) {
      return NextResponse.json(
        { success: false, error: 'weekStart is required (ISO date of Monday)' },
        { status: 400 }
      )
    }

    const plan = await prisma.weeklyPlan.create({
      data: {
        weekStart: new Date(weekStart),
        energyLevel: energyLevel || null,
        kidWeek: kidWeek !== undefined ? kidWeek : null,
        priorities: priorities || null,
        intentions: intentions || null,
        status: status || 'active',
      },
    })

    return NextResponse.json({ success: true, data: plan }, { status: 201 })
  } catch (error: any) {
    // Handle unique constraint violation (plan already exists for this week)
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A plan already exists for this week. Use PATCH to update.' },
        { status: 409 }
      )
    }
    console.error('Error creating plan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
