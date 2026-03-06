import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gym/activities/today
 * Returns all activities logged today (Sydney time).
 */
export async function GET() {
  try {
    const { startOfDay, endOfDay, dateStr } = getSydneyToday()

    const activities = await prisma.activity.findMany({
      where: { date: { gte: startOfDay, lte: endOfDay } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: { date: dateStr, activities, count: activities.length },
    })
  } catch (error) {
    console.error('Error fetching today activities:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch today activities' }, { status: 500 })
  }
}
