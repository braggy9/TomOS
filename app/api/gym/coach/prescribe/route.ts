import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/gym/coach/prescribe
 * Write a daily session prescription. Upserts by date (one per day).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionType, date, targetDistanceKm, targetHRZone, targetPace, warmup, mainSet, cooldown, notes, source } = body

    if (!sessionType) {
      return NextResponse.json({ success: false, error: 'sessionType is required' }, { status: 400 })
    }

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

    if (existing) {
      prescription = await prisma.coachPrescription.update({
        where: { id: existing.id },
        data: {
          sessionType,
          targetDistanceKm: targetDistanceKm ?? null,
          targetHRZone: targetHRZone ?? null,
          targetPace: targetPace ?? null,
          warmup: warmup ?? null,
          mainSet: mainSet ?? null,
          cooldown: cooldown ?? null,
          notes: notes ?? null,
          source: source || 'claude-coach',
        },
      })
      isUpdate = true
    } else {
      prescription = await prisma.coachPrescription.create({
        data: {
          date: startOfDay,
          sessionType,
          targetDistanceKm: targetDistanceKm ?? null,
          targetHRZone: targetHRZone ?? null,
          targetPace: targetPace ?? null,
          warmup: warmup ?? null,
          mainSet: mainSet ?? null,
          cooldown: cooldown ?? null,
          notes: notes ?? null,
          source: source || 'claude-coach',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: prescription,
      isUpdate,
    })
  } catch (error) {
    console.error('Error creating coach prescription:', error)
    return NextResponse.json({ success: false, error: 'Failed to create prescription' }, { status: 500 })
  }
}
