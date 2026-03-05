import { NextResponse } from 'next/server'

/**
 * GET /api/gym/sync/garmin/auth
 * Garmin OAuth stub
 */
export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Garmin integration not configured yet',
    message: 'Coming soon — Garmin Connect OAuth will be available here',
  }, { status: 501 })
}
