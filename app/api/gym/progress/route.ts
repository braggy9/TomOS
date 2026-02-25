import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/progress?exerciseId=xxx&period=90
 * Get weight progression for a specific exercise
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exerciseId')
    const period = parseInt(searchParams.get('period') || '90')

    if (!exerciseId) {
      return NextResponse.json(
        { success: false, error: 'exerciseId is required' },
        { status: 400 }
      )
    }

    const since = new Date()
    since.setDate(since.getDate() - period)

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { name: true },
    })

    if (!exercise) {
      return NextResponse.json(
        { success: false, error: 'Exercise not found' },
        { status: 404 }
      )
    }

    const sessionExercises = await prisma.sessionExercise.findMany({
      where: {
        exerciseId,
        session: { date: { gte: since } },
      },
      include: {
        sets: { orderBy: { setNumber: 'asc' } },
        session: { select: { date: true } },
      },
      orderBy: { session: { date: 'asc' } },
    })

    const dataPoints = sessionExercises
      .map(se => {
        const topSet = se.sets
          .filter(s => s.weight != null && s.weight > 0)
          .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0]

        if (!topSet) return null

        return {
          date: se.session.date.toISOString().split('T')[0],
          weight: topSet.weight!,
          reps: topSet.reps,
          rpe: topSet.rpe,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        exerciseId,
        exerciseName: exercise.name,
        dataPoints,
      },
    })
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch progress' }, { status: 500 })
  }
}
