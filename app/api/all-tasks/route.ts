import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { prisma } from "@/lib/prisma";

const NOTION_DATABASE_ID = "739144099ebc4ba1ba619dd1a5a08d25";
const USE_POSTGRES = process.env.USE_POSTGRES === "true";

/**
 * GET /api/all-tasks
 * Returns all tasks from Postgres or Notion database
 * Simple endpoint for iOS/macOS app task list view
 */
export async function GET() {
  try {
    // NEW: Postgres implementation
    if (USE_POSTGRES) {
      const tasks = await prisma.task.findMany({
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
          }
        },
        orderBy: [
          { priority: 'desc' }, // urgent > high > medium > low
          { dueDate: 'asc' },   // soonest first
        ],
        take: 100,
      });

      const formattedTasks = tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
        project: task.project,
        tags: task.tags.map((tt: any) => tt.tag),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }));

      console.log(`📋 Retrieved ${formattedTasks.length} tasks from Postgres`);

      return NextResponse.json({
        success: true,
        count: formattedTasks.length,
        tasks: formattedTasks,
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

    // Query all tasks, sorted by priority and due date
    const response = await (notion.databases as any).query({
      database_id: NOTION_DATABASE_ID,
      sorts: [
        {
          property: "Priority",
          direction: "ascending", // Urgent first
        },
        {
          property: "Due Date",
          direction: "ascending", // Soonest first
        },
      ],
      page_size: 100, // Limit to most recent 100 tasks
    });

    // Map Notion pages to simplified task format
    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.Task?.title?.[0]?.plain_text || "Untitled",
        status: props.Status?.select?.name || "Inbox",
        priority: props.Priority?.select?.name || null,
        context: props.Context?.multi_select?.map((c: any) => c.name) || [],
        dueDate: props["Due Date"]?.date?.start || null,
        energy: props.Energy?.select?.name || null,
        time: props.Time?.select?.name || null,
      };
    });

    console.log(`📋 Retrieved ${tasks.length} tasks from Notion`);

    return NextResponse.json({
      success: true,
      count: tasks.length,
      tasks,
      source: 'notion',
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
