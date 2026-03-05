import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/running/activities
 * List running activities with pagination and optional days filter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const since = new Date()
    since.setDate(since.getDate() - days)

    const [activities, total] = await Promise.all([
      prisma.runningSync.findMany({
        where: { date: { gte: since } },
        include: { runSession: true },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.runningSync.count({
        where: { date: { gte: since } },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching running activities:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 })
  }
}
