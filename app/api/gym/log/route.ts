import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { createGymTask, completeGymTask } from '@/lib/fitness/task-sync'

/**
 * POST /api/gym/log
 * Quick session logging — looks up exercises by name, creates session with all sets
 *
 * Body: {
 *   sessionType: "A",
 *   weekType?: "kid" | "non-kid",
 *   notes?: "Quick session before work",
 *   overallRPE?: 7,
 *   exercises: [
 *     { name: "RDL", weight: 60, sets: 3, reps: 8, rpe: 7 },
 *     { name: "Bulgarian Split Squat", weight: 16, sets: 3, reps: 10, rpe: 8 }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionType, weekType, notes, overallRPE, exercises } = body

    if (!sessionType || !exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { success: false, error: 'sessionType and exercises array are required' },
        { status: 400 }
      )
    }

    // Look up all exercises by name
    const exerciseNames = exercises.map((e: any) => e.name)
    const foundExercises = await prisma.exercise.findMany({
      where: {
        name: { in: exerciseNames, mode: 'insensitive' },
      },
    })

    // Build a map of name (lowercase) -> exercise
    const exerciseMap = new Map(
      foundExercises.map(e => [e.name.toLowerCase(), e])
    )

    // Check for unrecognized exercises
    const notFound = exerciseNames.filter(
      (name: string) => !exerciseMap.has(name.toLowerCase())
    )
    if (notFound.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Exercises not found: ${notFound.join(', ')}`,
          hint: 'Check exercise names or create them first via POST /api/gym/exercises',
        },
        { status: 400 }
      )
    }

    // Create the session with all exercises and sets
    const session = await prisma.gymSession.create({
      data: {
        sessionType,
        date: new Date(),
        weekType: weekType || null,
        notes: notes || null,
        overallRPE: overallRPE || null,
        completedAt: new Date(),
        sessionExercises: {
          create: exercises.map((ex: any, index: number) => {
            const exercise = exerciseMap.get(ex.name.toLowerCase())!
            const setCount = ex.sets || 1

            return {
              order: index + 1,
              exerciseId: exercise.id,
              sets: {
                create: Array.from({ length: setCount }, (_, i) => ({
                  setNumber: i + 1,
                  weight: ex.weight ?? null,
                  reps: ex.reps ?? null,
                  time: ex.time ?? null,
                  distance: ex.distance ?? null,
                  rpe: ex.rpe ?? null,
                })),
              },
            }
          }),
        },
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

    // Fire-and-forget: create task and immediately complete it (session is already done)
    createGymTask(session.id, sessionType, session.date)
      .then(() => {
        // After task is created and linked, complete it
        return prisma.gymSession.findUnique({ where: { id: session.id }, select: { taskId: true } })
      })
      .then((updated) => {
        if (updated?.taskId) return completeGymTask(updated.taskId)
      })
      .catch(() => {})

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Error quick-logging session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
