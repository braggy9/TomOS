import { NextResponse } from 'next/server'

/**
 * GET /api/gym/sync/garmin/callback
 * Garmin OAuth callback stub
 */
export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Garmin integration not configured yet',
  }, { status: 501 })
}
