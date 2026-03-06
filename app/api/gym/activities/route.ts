import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSydneyToday } from '@/lib/sydney-time'

const VALID_TYPES = ['swim', 'workout', 'mobility', 'yoga', 'cross-train', 'walk', 'other']

const createActivitySchema = z.object({
  activityType: z.string().refine(t => VALID_TYPES.includes(t), { message: `Must be one of: ${VALID_TYPES.join(', ')}` }),
  duration: z.number().int().min(1),
  distance: z.number().min(0).optional(),
  avgHeartRate: z.number().int().min(30).max(220).optional(),
  calories: z.number().int().min(0).optional(),
  activityName: z.string().optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  moodPost: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD, defaults to today (Sydney)
})

/**
 * GET /api/gym/activities
 * List activities with optional filters.
 * Query: ?days=90 (default 90), ?type=swim,workout (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '90')
    const typeFilter = request.nextUrl.searchParams.get('type')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const where: any = { date: { gte: since } }
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim())
      where.activityType = { in: types }
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: { activities, count: activities.length, days },
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 })
  }
}

/**
 * POST /api/gym/activities
 * Create a manual activity.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createActivitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { date: dateStr, ...data } = parsed.data

    // Default to today (Sydney) if no date provided
    let activityDate: Date
    if (dateStr) {
      activityDate = new Date(dateStr + 'T12:00:00Z') // noon UTC for safe date
    } else {
      const { startOfDay } = getSydneyToday()
      activityDate = new Date(startOfDay.getTime() + 12 * 60 * 60 * 1000) // noon Sydney day in UTC
    }

    const activity = await prisma.activity.create({
      data: {
        ...data,
        date: activityDate,
        source: 'manual',
        distance: data.distance ?? null,
        avgHeartRate: data.avgHeartRate ?? null,
        calories: data.calories ?? null,
        activityName: data.activityName ?? null,
        rpe: data.rpe ?? null,
        moodPost: data.moodPost ?? null,
        notes: data.notes ?? null,
      },
    })

    return NextResponse.json({ success: true, data: activity })
  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json({ success: false, error: 'Failed to create activity' }, { status: 500 })
  }
}
