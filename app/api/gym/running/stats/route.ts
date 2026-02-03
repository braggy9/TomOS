import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/running/stats
 * Running statistics — last 7 days, last 30 days, load trend
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const last7 = new Date(now)
    last7.setDate(last7.getDate() - 7)
    const last30 = new Date(now)
    last30.setDate(last30.getDate() - 30)
    const prev7Start = new Date(now)
    prev7Start.setDate(prev7Start.getDate() - 14)

    const [stats7, stats30, prevStats7] = await Promise.all([
      prisma.runningSync.aggregate({
        where: { date: { gte: last7 } },
        _sum: { distance: true, duration: true, trainingLoad: true },
        _count: true,
      }),
      prisma.runningSync.aggregate({
        where: { date: { gte: last30 } },
        _sum: { distance: true, duration: true, trainingLoad: true },
        _count: true,
      }),
      prisma.runningSync.aggregate({
        where: { date: { gte: prev7Start, lt: last7 } },
        _sum: { trainingLoad: true },
      }),
    ])

    const currentLoad = stats7._sum.trainingLoad || 0
    const previousLoad = prevStats7._sum.trainingLoad || 0

    let loadTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (previousLoad > 0) {
      if (currentLoad > previousLoad * 1.15) loadTrend = 'increasing'
      else if (currentLoad < previousLoad * 0.85) loadTrend = 'decreasing'
    }

    return NextResponse.json({
      success: true,
      data: {
        last7Days: {
          totalDistance: Math.round((stats7._sum.distance || 0) * 10) / 10,
          totalDuration: stats7._sum.duration || 0,
          trainingLoad: currentLoad,
          sessions: stats7._count,
        },
        last30Days: {
          totalDistance: Math.round((stats30._sum.distance || 0) * 10) / 10,
          totalDuration: stats30._sum.duration || 0,
          trainingLoad: stats30._sum.trainingLoad || 0,
          sessions: stats30._count,
        },
        loadTrend,
      },
    })
  } catch (error) {
    console.error('Error fetching running stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch running stats' },
      { status: 500 }
    )
  }
}
