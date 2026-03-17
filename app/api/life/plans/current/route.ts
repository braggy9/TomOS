import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSydneyToday } from '@/lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/plans/current
 * Get this week's plan, auto-creating if none exists.
 * Calculates Monday of current week in Sydney TZ.
 */
export async function GET() {
  try {
    const { sydneyDate } = getSydneyToday()

    // Calculate Monday of current week (Sydney TZ)
    const dayOfWeek = sydneyDate.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(sydneyDate)
    monday.setUTCDate(monday.getUTCDate() - daysFromMonday)
    monday.setUTCHours(0, 0, 0, 0)

    // Try to find existing plan for this week
    let plan = await prisma.weeklyPlan.findUnique({
      where: { weekStart: monday },
    })

    // Auto-create if none exists
    if (!plan) {
      plan = await prisma.weeklyPlan.create({
        data: {
          weekStart: monday,
          status: 'draft',
        },
      })
    }

    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error fetching current plan:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch current plan' }, { status: 500 })
  }
}
