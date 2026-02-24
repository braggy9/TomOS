import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/recovery
 * Get recent recovery check-ins
 * Query params: days (default 14)
 */
export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '14')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const checkins = await prisma.recoveryCheckin.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ success: true, data: checkins })
  } catch (error) {
    console.error('Error fetching recovery check-ins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recovery check-ins' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gym/recovery
 * Create or update today's recovery check-in
 * Body: { sleepQuality, energy, soreness, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sleepQuality, energy, soreness, notes } = body

    if (!sleepQuality || !energy || !soreness) {
      return NextResponse.json(
        { success: false, error: 'sleepQuality, energy, and soreness are required' },
        { status: 400 }
      )
    }

    const validSleep = ['bad', 'ok', 'great']
    const validEnergy = ['low', 'medium', 'high']
    const validSoreness = ['none', 'mild', 'sore']

    if (!validSleep.includes(sleepQuality)) {
      return NextResponse.json(
        { success: false, error: `sleepQuality must be one of: ${validSleep.join(', ')}` },
        { status: 400 }
      )
    }
    if (!validEnergy.includes(energy)) {
      return NextResponse.json(
        { success: false, error: `energy must be one of: ${validEnergy.join(', ')}` },
        { status: 400 }
      )
    }
    if (!validSoreness.includes(soreness)) {
      return NextResponse.json(
        { success: false, error: `soreness must be one of: ${validSoreness.join(', ')}` },
        { status: 400 }
      )
    }

    // Use Sydney date for "today"
    const sydneyDate = new Date(
      new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    )

    const checkin = await prisma.recoveryCheckin.upsert({
      where: { date: sydneyDate },
      create: {
        date: sydneyDate,
        sleepQuality,
        energy,
        soreness,
        notes: notes || null,
      },
      update: {
        sleepQuality,
        energy,
        soreness,
        notes: notes || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: checkin }, { status: 201 })
  } catch (error) {
    console.error('Error saving recovery check-in:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save recovery check-in' },
      { status: 500 }
    )
  }
}
