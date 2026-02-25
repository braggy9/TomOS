import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/gym/recovery/today — Get today's recovery check-in
 */
export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const checkin = await prisma.recoveryCheckIn.findFirst({
      where: {
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: checkin })
  } catch (error) {
    console.error('Error fetching today recovery:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch check-in' }, { status: 500 })
  }
}
