import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gym/exercises
 * List exercises with optional filtering
 * Query params: category, movement, search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const movement = searchParams.get('movement')
    const search = searchParams.get('search')

    const where: any = {}
    if (category) where.category = category
    if (movement) where.movementPattern = movement
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ success: true, data: exercises })
  } catch (error) {
    console.error('Error fetching exercises:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exercises' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gym/exercises
 * Create a new exercise
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name || !body.category) {
      return NextResponse.json(
        { success: false, error: 'name and category are required' },
        { status: 400 }
      )
    }

    const exercise = await prisma.exercise.create({
      data: {
        name: body.name,
        category: body.category,
        equipment: body.equipment || [],
        primaryMuscles: body.primaryMuscles || [],
        movementPattern: body.movementPattern || null,
        cues: body.cues || null,
        spineNotes: body.spineNotes || null,
        videoUrl: body.videoUrl || null,
      },
    })

    return NextResponse.json({ success: true, data: exercise }, { status: 201 })
  } catch (error: any) {
    // Handle unique constraint violation (duplicate exercise name)
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'An exercise with that name already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating exercise:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create exercise' },
      { status: 500 }
    )
  }
}
