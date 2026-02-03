import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/exercises/[id]
 * Get a single exercise with recent session history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const exercise = await prisma.exercise.findUnique({
      where: { id },
      include: {
        sessionExercises: {
          include: {
            sets: { orderBy: { setNumber: 'asc' } },
            session: { select: { id: true, date: true, sessionType: true } },
          },
          orderBy: { session: { date: 'desc' } },
          take: 10,
        },
      },
    })

    if (!exercise) {
      return NextResponse.json(
        { success: false, error: 'Exercise not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: exercise })
  } catch (error) {
    console.error('Error fetching exercise:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exercise' },
      { status: 500 }
    )
  }
}
