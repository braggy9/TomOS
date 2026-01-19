import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { prisma } from "@/lib/prisma";

const USE_POSTGRES = process.env.USE_POSTGRES === "true";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // NEW: Postgres implementation
    if (USE_POSTGRES) {
      const task = await prisma.task.update({
        where: { id },
        data: {
          status: 'done',
          completedAt: new Date(),
        },
      });

      console.log(`✅ Marked Postgres task as complete: ${task.id}`);

      return NextResponse.json({
        success: true,
        taskId: task.id,
        message: "Task marked as complete",
        source: 'postgres',
      });
    }

    // OLD: Notion implementation (fallback)
    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { error: "NOTION_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    // Update the task status to "Done"
    const response = await notion.pages.update({
      page_id: id,
      properties: {
        Status: {
          select: { name: "Done" },
        },
      },
    });

    console.log(`✅ Marked Notion task as complete: ${response.id}`);

    return NextResponse.json({
      success: true,
      pageId: response.id,
      message: "Task marked as complete",
      source: 'notion',
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
