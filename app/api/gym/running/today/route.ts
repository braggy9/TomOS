import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gym/running/today
 * Check if there's a Strava run today (Sydney timezone)
 */
export async function GET() {
  try {
    const { startOfDay, endOfDay } = getSydneyToday()

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
