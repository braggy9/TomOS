import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { createGymTask, completeGymTask } from '@/lib/fitness/task-sync'

/**
 * GET /api/gym/sessions
 * List gym sessions with optional filtering
 * Query params: type, from, to, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionType = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (sessionType) where.sessionType = sessionType
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    const [sessions, total] = await Promise.all([
      prisma.gymSession.findMany({
        where,
        include: {
          sessionExercises: {
            include: {
              exercise: true,
              sets: { orderBy: { setNumber: 'asc' } },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.gymSession.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    })
  } catch (error) {
    console.error('Error fetching gym sessions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gym/sessions
 * Create a new gym session with optional exercises and sets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionType, date, duration, notes, overallRPE, weekType, taskId, exercises } = body

    if (!sessionType) {
      return NextResponse.json(
        { success: false, error: 'sessionType is required' },
        { status: 400 }
      )
    }

    const session = await prisma.gymSession.create({
      data: {
        sessionType,
        date: date ? new Date(date) : new Date(),
        duration: duration || null,
        notes: notes || null,
        overallRPE: overallRPE || null,
        weekType: weekType || null,
        taskId: taskId || null,
        completedAt: exercises ? new Date() : null,
        sessionExercises: exercises
          ? {
              create: exercises.map((ex: any, index: number) => ({
                order: index + 1,
                exerciseId: ex.exerciseId,
                sets: ex.sets
                  ? {
                      create: ex.sets.map((set: any, setIndex: number) => ({
                        setNumber: setIndex + 1,
                        weight: set.weight ?? null,
                        reps: set.reps ?? null,
                        time: set.time ?? null,
                        distance: set.distance ?? null,
                        rpe: set.rpe ?? null,
                        notes: set.notes ?? null,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        sessionExercises: {
          include: {
            exercise: true,
            sets: { orderBy: { setNumber: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    // Fire-and-forget: create linked TomOS task if none provided
    if (!taskId) {
      createGymTask(session.id, sessionType, session.date).catch(() => {})
    }

    // Fire-and-forget: complete task if session is already completed
    if (session.completedAt && session.taskId) {
      completeGymTask(session.taskId).catch(() => {})
    }

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Error creating gym session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
