import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/recovery — List recovery check-ins
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '30')

    const checkins = await prisma.recoveryCheckIn.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: checkins })
  } catch (error) {
    console.error('Error fetching recovery check-ins:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch check-ins' }, { status: 500 })
  }
}

/**
 * POST /api/gym/recovery — Create a recovery check-in
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sleepQuality, soreness, energy, motivation, hoursSlept, notes } = body

    if (!sleepQuality || !soreness || !energy || !motivation) {
      return NextResponse.json(
        { success: false, error: 'sleepQuality, soreness, energy, and motivation are required (1-5)' },
        { status: 400 }
      )
    }

    const readinessScore = (sleepQuality + soreness + energy + motivation) / 4

    const checkin = await prisma.recoveryCheckIn.create({
      data: {
        sleepQuality,
        soreness,
        energy,
        motivation,
        hoursSlept: hoursSlept ?? null,
        notes: notes ?? null,
        readinessScore,
      },
    })

    return NextResponse.json({ success: true, data: checkin }, { status: 201 })
  } catch (error) {
    console.error('Error creating recovery check-in:', error)
    return NextResponse.json({ success: false, error: 'Failed to create check-in' }, { status: 500 })
  }
}
