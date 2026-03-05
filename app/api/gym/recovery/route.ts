import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// Map string values from frontend to numeric 1-5 scale
const SLEEP_MAP: Record<string, number> = { bad: 1, ok: 3, great: 5 }
const ENERGY_MAP: Record<string, number> = { low: 1, medium: 3, high: 5 }
const SORENESS_MAP: Record<string, number> = { sore: 1, mild: 3, none: 5 }

function toNumeric(value: string | number, map: Record<string, number>): number | null {
  if (typeof value === 'number') return value
  return map[value] ?? null
}

/**
 * GET /api/gym/recovery — List recovery check-ins
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '30')

    const checkins = await prisma.recoveryCheckIn.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    })

    // Map numeric values back to strings for frontend
    const mapped = checkins.map((c) => ({
      ...c,
      sleepQuality: c.sleepQuality >= 4 ? 'great' : c.sleepQuality >= 2 ? 'ok' : 'bad',
      energy: c.energy >= 4 ? 'high' : c.energy >= 2 ? 'medium' : 'low',
      soreness: c.soreness >= 4 ? 'none' : c.soreness >= 2 ? 'mild' : 'sore',
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error) {
    console.error('Error fetching recovery check-ins:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch check-ins' }, { status: 500 })
  }
}

/**
 * POST /api/gym/recovery — Create a recovery check-in
 * Accepts both string values ("bad"/"ok"/"great") and numeric (1-5)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sleepQuality, soreness, energy, motivation, hoursSlept, notes } = body

    const sleepNum = toNumeric(sleepQuality, SLEEP_MAP)
    const energyNum = toNumeric(energy, ENERGY_MAP)
    const sorenessNum = toNumeric(soreness, SORENESS_MAP)
    // Motivation is optional — default to 3 if not provided
    const motivationNum = motivation ? toNumeric(motivation, { low: 1, medium: 3, high: 5 }) ?? 3 : 3

    if (sleepNum === null || energyNum === null || sorenessNum === null) {
      return NextResponse.json(
        { success: false, error: 'sleepQuality, soreness, and energy are required' },
        { status: 400 }
      )
    }

    const readinessScore = (sleepNum + sorenessNum + energyNum + motivationNum) / 4

    // Upsert by today's date (Sydney timezone) to allow updates
    const sydneyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    const startOfDay = new Date(`${sydneyDate}T00:00:00+11:00`)
    const endOfDay = new Date(`${sydneyDate}T23:59:59+11:00`)

    const existing = await prisma.recoveryCheckIn.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
    })

    let checkin
    if (existing) {
      checkin = await prisma.recoveryCheckIn.update({
        where: { id: existing.id },
        data: {
          sleepQuality: sleepNum,
          soreness: sorenessNum,
          energy: energyNum,
          motivation: motivationNum,
          hoursSlept: hoursSlept ?? null,
          notes: notes ?? null,
          readinessScore,
        },
      })
    } else {
      checkin = await prisma.recoveryCheckIn.create({
        data: {
          sleepQuality: sleepNum,
          soreness: sorenessNum,
          energy: energyNum,
          motivation: motivationNum,
          hoursSlept: hoursSlept ?? null,
          notes: notes ?? null,
          readinessScore,
        },
      })
    }

    // Map back to strings for frontend
    const mapped = {
      ...checkin,
      sleepQuality: checkin.sleepQuality >= 4 ? 'great' : checkin.sleepQuality >= 2 ? 'ok' : 'bad',
      energy: checkin.energy >= 4 ? 'high' : checkin.energy >= 2 ? 'medium' : 'low',
      soreness: checkin.soreness >= 4 ? 'none' : checkin.soreness >= 2 ? 'mild' : 'sore',
    }

    return NextResponse.json({ success: true, data: mapped }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('Error creating recovery check-in:', error)
    return NextResponse.json({ success: false, error: 'Failed to create check-in' }, { status: 500 })
  }
}
