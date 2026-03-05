import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/settings
 * Returns user settings (creates singleton if missing)
 */
export async function GET() {
  try {
    const settings = await prisma.userSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })
    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PATCH /api/gym/settings
 * Update user settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { maxHeartRate, restingHR, defaultWeekType } = body

    const settings = await prisma.userSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        ...(maxHeartRate !== undefined && { maxHeartRate }),
        ...(restingHR !== undefined && { restingHR }),
        ...(defaultWeekType !== undefined && { defaultWeekType }),
      },
      update: {
        ...(maxHeartRate !== undefined && { maxHeartRate }),
        ...(restingHR !== undefined && { restingHR }),
        ...(defaultWeekType !== undefined && { defaultWeekType }),
      },
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 })
  }
}
