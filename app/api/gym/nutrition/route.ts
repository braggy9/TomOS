import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/nutrition — List nutrition logs
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '30')

    const logs = await prisma.nutritionLog.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('Error fetching nutrition logs:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 })
  }
}

/**
 * POST /api/gym/nutrition — Create a nutrition log
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proteinRating, hydrationRating, vegetableRating, notes } = body

    const log = await prisma.nutritionLog.create({
      data: {
        proteinRating: proteinRating ?? null,
        hydrationRating: hydrationRating ?? null,
        vegetableRating: vegetableRating ?? null,
        notes: notes ?? null,
      },
    })

    return NextResponse.json({ success: true, data: log }, { status: 201 })
  } catch (error) {
    console.error('Error creating nutrition log:', error)
    return NextResponse.json({ success: false, error: 'Failed to create log' }, { status: 500 })
  }
}
