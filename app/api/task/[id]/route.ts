import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UpdateTaskBody = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["Inbox", "To Do", "In Progress", "Done"]).optional(),
  priority: z.enum(["Urgent", "Important", "Someday"]).optional(),
  context: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        children: {
          include: {
            tags: { include: { tag: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const formatTask = (t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
      parentId: t.parentId || null,
      tags: t.tags?.map((tt: any) => tt.tag) || [],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      task: {
        ...formatTask(task),
        subtasks: task.children.map(formatTask),
        subtaskCount: task.children.length,
      },
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    // Validate request body
    const validatedData = UpdateTaskBody.parse(body);

    // Map legacy status/priority values to Prisma values
    const statusMap: Record<string, string> = {
      'Inbox': 'todo',
      'To Do': 'todo',
      'In Progress': 'in_progress',
      'Done': 'done',
    };

    const priorityMap: Record<string, string> = {
      'Urgent': 'urgent',
      'Important': 'high',
      'Someday': 'low',
    };

    // Build update data
    const updateData: any = {};

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }

    if (validatedData.status !== undefined) {
      updateData.status = statusMap[validatedData.status] || validatedData.status.toLowerCase();
      // Set completedAt when marking as done
      if (updateData.status === 'done') {
        updateData.completedAt = new Date();
      }
    }

    if (validatedData.priority !== undefined) {
      updateData.priority = priorityMap[validatedData.priority] || 'medium';
    }

    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }

    if (validatedData.parentId !== undefined) {
      updateData.parentId = validatedData.parentId;
    }

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    // Handle context as tags
    if (validatedData.context !== undefined) {
      for (const contextValue of validatedData.context) {
        const tag = await prisma.tag.upsert({
          where: { name: `context:${contextValue}` },
          update: {},
          create: { name: `context:${contextValue}` },
        });

        await prisma.taskTag.upsert({
          where: {
            taskId_tagId: {
              taskId: task.id,
              tagId: tag.id,
            },
          },
          update: {},
          create: {
            taskId: task.id,
            tagId: tag.id,
          },
        });
      }
    }

    // Handle tags
    if (validatedData.tags !== undefined) {
      // Remove existing tags
      await prisma.taskTag.deleteMany({
        where: {
          taskId: task.id,
          tag: {
            name: {
              notIn: validatedData.context?.map(c => `context:${c}`) || []
            }
          }
        },
      });

      // Add new tags
      for (const tagName of validatedData.tags) {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });

        await prisma.taskTag.upsert({
          where: {
            taskId_tagId: {
              taskId: task.id,
              tagId: tag.id,
            },
          },
          update: {},
          create: {
            taskId: task.id,
            tagId: tag.id,
          },
        });
      }
    }

    console.log(`Updated Postgres task: ${task.id}`);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: "Task updated successfully",
      updated: validatedData,
      source: 'postgres',
    });
  } catch (error) {
    console.error("Error updating task:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
