import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/coach/activities
 * Running activity list with subjective data for the coach.
 * Query: ?days=30 (default 30), ?type=easy,tempo (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const typeFilter = searchParams.get('type')?.split(',').filter(Boolean)

    const since = new Date()
    since.setDate(since.getDate() - days)

    const where: Record<string, unknown> = { date: { gte: since } }
    if (typeFilter && typeFilter.length > 0) {
      where.type = { in: typeFilter }
    }

    const activities = await prisma.runningSync.findMany({
      where,
      include: { runSession: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        activities: activities.map(a => ({
          id: a.id,
          date: a.date,
          type: a.runSession?.sessionTypeOverride || a.type,
          activityName: a.activityName,
          distance: Math.round(a.distance * 10) / 10,
          duration: a.duration,
          avgPace: a.avgPace ? Math.round(a.avgPace * 100) / 100 : null,
          avgHeartRate: a.avgHeartRate,
          maxHeartRate: a.maxHeartRate,
          elevationGain: a.elevationGain,
          trainingLoad: a.trainingLoad,
          splits: a.splits,
          sufferScore: a.sufferScore,
          runSession: a.runSession
            ? {
                rpe: a.runSession.rpe,
                moodPost: a.runSession.moodPost,
                sessionTypeOverride: a.runSession.sessionTypeOverride,
                notes: a.runSession.notes,
              }
            : null,
        })),
        count: activities.length,
        days,
      },
    })
  } catch (error) {
    console.error('Error fetching coach activities:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 })
  }
}
