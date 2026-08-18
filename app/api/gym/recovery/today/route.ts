import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireTrainingReadAccess } from '../../../../../lib/server-auth'
import { getSydneyToday } from '../../../../../lib/sydney-time'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gym/recovery/today — Get today's recovery check-in
 */
export async function GET(request: Request) {
  const authError = requireTrainingReadAccess(request)
  if (authError) return authError

  try {
    const { startOfDay, endOfDay } = getSydneyToday()

    const checkin = await prisma.recoveryCheckIn.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      { success: true, data: checkin },
      { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } }
    )
  } catch (error) {
    console.error('Error fetching today recovery:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch check-in' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      }
    )
  }
}
