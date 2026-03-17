import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/training/cleanup
 * One-time endpoint to delete all auto-generated TrainingBlock / TrainingWeek /
 * PlannedSession data. CoachPrescription is the sole source of daily guidance.
 *
 * Protected by CRON_SECRET.
 *
 * curl -X DELETE https://tomos-task-api.vercel.app/api/training/cleanup \
 *   -H "Authorization: Bearer <CRON_SECRET>"
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Delete in dependency order: sessions → weeks → blocks
    const deletedSessions = await prisma.plannedSession.deleteMany({})
    const deletedWeeks = await prisma.trainingWeek.deleteMany({})
    const deletedBlocks = await prisma.trainingBlock.deleteMany({})

    return NextResponse.json({
      success: true,
      data: {
        deletedSessions: deletedSessions.count,
        deletedWeeks: deletedWeeks.count,
        deletedBlocks: deletedBlocks.count,
      },
    })
  } catch (error) {
    console.error('Error cleaning up training plan data:', error)
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 })
  }
}
