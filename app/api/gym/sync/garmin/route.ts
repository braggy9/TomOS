import { NextResponse } from 'next/server'

/**
 * POST /api/gym/sync/garmin
 * Garmin webhook stub
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Garmin integration not configured yet',
    message: 'Coming soon — Garmin Connect webhook endpoint',
  }, { status: 501 })
}
