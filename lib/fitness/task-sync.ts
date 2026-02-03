import { prisma } from '@/lib/prisma'

/**
 * Create a linked TomOS task for a gym session (fire-and-forget)
 */
export async function createGymTask(
  sessionId: string,
  sessionType: string,
  date: Date
): Promise<void> {
  try {
    const task = await prisma.task.create({
      data: {
        title: `Gym: Session ${sessionType}`,
        status: 'todo',
        priority: 'medium',
        dueDate: date,
      },
    })

    await prisma.gymSession.update({
      where: { id: sessionId },
      data: { taskId: task.id },
    })
  } catch (error) {
    console.error('Background task creation failed:', error)
  }
}

/**
 * Mark the linked task as done when a session is completed (fire-and-forget)
 */
export async function completeGymTask(taskId: string): Promise<void> {
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'done', completedAt: new Date() },
    })
  } catch (error) {
    console.error('Background task completion failed:', error)
  }
}
