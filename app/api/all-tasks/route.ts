import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/all-tasks
 * Returns all tasks from Postgres database
 * Simple endpoint for task list view
 */
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        parentId: null, // Only top-level tasks (not subtasks)
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            color: true,
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        children: {
          select: { id: true },
        },
      },
      orderBy: [
        { priority: 'desc' }, // urgent > high > medium > low
        { dueDate: 'asc' },   // soonest first
      ],
      take: 100,
    });

    const statusMap: Record<string, string> = {
      'todo': 'Inbox',
      'in_progress': 'In Progress',
      'done': 'Done',
    };
    const priorityMap: Record<string, string> = {
      'urgent': 'Urgent',
      'high': 'Important',
      'medium': 'Important',
      'low': 'Someday',
    };

    const formattedTasks = tasks.map((task: any) => {
      const tagNames: string[] = task.tags.map((tt: any) => tt.tag.name);
      const context = tagNames
        .filter((t) => t.startsWith('context:'))
        .map((t) => t.replace('context:', ''));
      const energyTag = tagNames.find((t) => t.startsWith('energy:'));
      const timeTag = tagNames.find((t) => t.startsWith('time:'));

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: statusMap[task.status] ?? task.status,
        priority: priorityMap[task.priority] ?? task.priority,
        dueDate: task.dueDate?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
        parentId: task.parentId || null,
        subtaskCount: task.children?.length || 0,
        project: task.project,
        tags: task.tags.map((tt: any) => tt.tag),
        context,
        energy: energyTag ? energyTag.replace('energy:', '') : null,
        time: timeTag ? timeTag.replace('time:', '') : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    console.log(`Retrieved ${formattedTasks.length} tasks from Postgres`);

    return NextResponse.json({
      success: true,
      count: formattedTasks.length,
      tasks: formattedTasks,
      source: 'postgres',
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tasks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
