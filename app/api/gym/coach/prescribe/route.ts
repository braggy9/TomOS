import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Shared upsert logic for both GET and POST handlers.
 */
async function upsertPrescription(params: {
  sessionType: string
  date?: string
  targetDistanceKm?: number
  targetHRZone?: string
  targetPace?: string
  warmup?: string
  mainSet?: string
  cooldown?: string
  notes?: string
  source?: string
}) {
  const { sessionType, date, targetDistanceKm, targetHRZone, targetPace, warmup, mainSet, cooldown, notes, source } = params

  // Default to tomorrow (Sydney time) if no date provided
  let prescriptionDate: Date
  if (date) {
    prescriptionDate = new Date(date)
  } else {
    const now = new Date()
    const sydneyDate = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
    sydneyDate.setDate(sydneyDate.getDate() + 1)
    sydneyDate.setHours(0, 0, 0, 0)
    prescriptionDate = sydneyDate
  }

  // Day boundaries for upsert lookup
  const startOfDay = new Date(prescriptionDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(prescriptionDate)
  endOfDay.setHours(23, 59, 59, 999)

  // Check for existing prescription on this date
  const existing = await prisma.coachPrescription.findFirst({
    where: { date: { gte: startOfDay, lte: endOfDay } },
  })

  let prescription
  let isUpdate = false

  const data = {
    sessionType,
    targetDistanceKm: targetDistanceKm != null ? Number(targetDistanceKm) : null,
    targetHRZone: targetHRZone ?? null,
    targetPace: targetPace ?? null,
    warmup: warmup ?? null,
    mainSet: mainSet ?? null,
    cooldown: cooldown ?? null,
    notes: notes ?? null,
    source: source || 'claude-coach',
  }

  if (existing) {
    prescription = await prisma.coachPrescription.update({
      where: { id: existing.id },
      data,
    })
    isUpdate = true
  } else {
    prescription = await prisma.coachPrescription.create({
      data: { ...data, date: startOfDay },
    })
  }

  return { prescription, isUpdate }
}

/**
 * GET /api/gym/coach/prescribe
 * Bridge for Claude chat (web_fetch only supports GET).
 * Example: GET /api/gym/coach/prescribe?sessionType=easy&targetDistanceKm=7&targetHRZone=Z2&notes=Easy+run
 */
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams
    const sessionType = p.get('sessionType')

    if (!sessionType) {
      return NextResponse.json({ success: false, error: 'sessionType is required' }, { status: 400 })
    }

    const { prescription, isUpdate } = await upsertPrescription({
      sessionType,
      date: p.get('date') || undefined,
      targetDistanceKm: p.get('targetDistanceKm') ? Number(p.get('targetDistanceKm')) : undefined,
      targetHRZone: p.get('targetHRZone') || undefined,
      targetPace: p.get('targetPace') || undefined,
      warmup: p.get('warmup') || undefined,
      mainSet: p.get('mainSet') || undefined,
      cooldown: p.get('cooldown') || undefined,
      notes: p.get('notes') || undefined,
      source: p.get('source') || undefined,
    })

    return NextResponse.json({ success: true, data: prescription, isUpdate })
  } catch (error) {
    console.error('Error creating coach prescription (GET):', error)
    return NextResponse.json({ success: false, error: 'Failed to create prescription' }, { status: 500 })
  }
}

/**
 * POST /api/gym/coach/prescribe
 * Write a daily session prescription. Upserts by date (one per day).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.sessionType) {
      return NextResponse.json({ success: false, error: 'sessionType is required' }, { status: 400 })
    }

    const { prescription, isUpdate } = await upsertPrescription(body)

    return NextResponse.json({ success: true, data: prescription, isUpdate })
  } catch (error) {
    console.error('Error creating coach prescription:', error)
    return NextResponse.json({ success: false, error: 'Failed to create prescription' }, { status: 500 })
  }
}
