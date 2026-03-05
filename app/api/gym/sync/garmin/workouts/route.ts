import { NextResponse } from 'next/server'

/**
 * GET /api/gym/sync/garmin/workouts
 * Garmin workouts stub — returns empty array
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: [],
    message: 'Garmin integration not configured yet — no workouts available',
  })
}
