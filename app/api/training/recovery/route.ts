import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/training/recovery — Latest recovery check-in
 * Returns raw numeric values (1-5 scale) for dashboard meters.
 */
export async function GET() {
  try {
    const checkin = await prisma.recoveryCheckIn.findFirst({
      orderBy: { date: 'desc' },
    })

    if (!checkin) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No recovery check-ins found',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        sleepQuality: checkin.sleepQuality,
        soreness: checkin.soreness,
        energy: checkin.energy,
        motivation: checkin.motivation,
        hoursSlept: checkin.hoursSlept,
        date: checkin.date.toISOString(),
        notes: checkin.notes,
        readinessScore: checkin.readinessScore,
      },
    })
  } catch (error) {
    console.error('Error fetching latest recovery:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recovery data' },
      { status: 500 }
    )
  }
}
