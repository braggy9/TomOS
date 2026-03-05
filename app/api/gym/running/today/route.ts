import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/gym/running/today
 * Check if there's a Strava run today (Sydney timezone)
 */
export async function GET() {
  try {
    const now = new Date()
    const sydneyDate = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
    const startOfDay = new Date(sydneyDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(sydneyDate)
    endOfDay.setHours(23, 59, 59, 999)

    const todayRun = await prisma.runningSync.findFirst({
      where: { date: { gte: startOfDay, lte: endOfDay } },
      include: { runSession: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        hasRun: !!todayRun,
        run: todayRun,
      },
    })
  } catch (error) {
    console.error('Error checking today run:', error)
    return NextResponse.json({ success: false, error: 'Failed to check today run' }, { status: 500 })
  }
}
