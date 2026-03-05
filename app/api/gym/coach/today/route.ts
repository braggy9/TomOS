import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/gym/coach/today
 * Today's snapshot — run, recovery, prescription, and planned session.
 */
export async function GET() {
  try {
    // Sydney timezone boundary
    const now = new Date()
    const sydneyDate = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
    const startOfDay = new Date(sydneyDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(sydneyDate)
    endOfDay.setHours(23, 59, 59, 999)

    const dateStr = sydneyDate.toISOString().slice(0, 10)

    // dayOfWeek: 1=Mon ... 7=Sun
    const jsDay = sydneyDate.getDay()
    const todayDayOfWeek = jsDay === 0 ? 7 : jsDay

    const [todayRun, todayRecovery, todayPrescription, currentWeek] = await Promise.all([
      prisma.runningSync.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        include: { runSession: true },
        orderBy: { date: 'desc' },
      }),
      prisma.recoveryCheckIn.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { date: 'desc' },
      }),
      prisma.coachPrescription.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.trainingWeek.findFirst({
        where: {
          startDate: { lte: endOfDay },
          block: { status: 'active' },
        },
        include: {
          sessions: {
            where: { dayOfWeek: todayDayOfWeek },
            include: {
              linkedRun: { select: { id: true, distance: true, type: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
    ])

    // Filter planned session by week type
    let plannedSession = null
    if (currentWeek && currentWeek.sessions.length > 0) {
      const applicable = currentWeek.sessions.filter(s => {
        if (currentWeek.weekType === 'kid') return !s.isNonKidOnly
        if (currentWeek.weekType === 'non-kid') return !s.isKidWeekOnly
        return true
      })
      if (applicable.length > 0) {
        const s = applicable[0]
        plannedSession = {
          sessionType: s.sessionType,
          targetDistanceKm: s.targetDistanceKm,
          sessionName: s.sessionName,
          targetPaceZone: s.targetPaceZone,
          notes: s.notes,
          status: s.status,
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        hasRun: !!todayRun,
        run: todayRun,
        recovery: todayRecovery
          ? {
              sleepQuality: todayRecovery.sleepQuality,
              energy: todayRecovery.energy,
              soreness: todayRecovery.soreness,
              motivation: todayRecovery.motivation,
              readinessScore: todayRecovery.readinessScore,
              notes: todayRecovery.notes,
            }
          : null,
        prescription: todayPrescription
          ? {
              sessionType: todayPrescription.sessionType,
              targetDistanceKm: todayPrescription.targetDistanceKm,
              targetHRZone: todayPrescription.targetHRZone,
              targetPace: todayPrescription.targetPace,
              warmup: todayPrescription.warmup,
              mainSet: todayPrescription.mainSet,
              cooldown: todayPrescription.cooldown,
              notes: todayPrescription.notes,
            }
          : null,
        plannedSession,
      },
    })
  } catch (error) {
    console.error('Error fetching coach today:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch today snapshot' }, { status: 500 })
  }
}
