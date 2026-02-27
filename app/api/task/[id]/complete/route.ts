import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'done',
        completedAt: new Date(),
      },
    });

    console.log(`Marked task as complete: ${task.id}`);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: "Task marked as complete",
      source: 'postgres',
    });
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json(
      {
        error: "Failed to complete task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
