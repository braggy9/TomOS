import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/life/plans/[id]
 * Get a single weekly plan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const plan = await prisma.weeklyPlan.findUnique({ where: { id } })

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error fetching plan:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch plan' }, { status: 500 })
  }
}

/**
 * PATCH /api/life/plans/[id]
 * Update a weekly plan (priorities, intentions, reflection, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { energyLevel, kidWeek, priorities, intentions, reflection, satisfactionScore, status } = body

    const data: any = {}
    if (energyLevel !== undefined) data.energyLevel = energyLevel
    if (kidWeek !== undefined) data.kidWeek = kidWeek
    if (priorities !== undefined) data.priorities = priorities
    if (intentions !== undefined) data.intentions = intentions
    if (reflection !== undefined) data.reflection = reflection
    if (satisfactionScore !== undefined) data.satisfactionScore = satisfactionScore
    if (status !== undefined) data.status = status

    const plan = await prisma.weeklyPlan.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error updating plan:', error)
    return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 })
  }
}
