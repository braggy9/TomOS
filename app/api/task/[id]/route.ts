import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { z } from "zod";

const UpdateTaskBody = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["Inbox", "To Do", "In Progress", "Done"]).optional(),
  priority: z.enum(["Urgent", "Important", "Someday"]).optional(),
  context: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    // Validate request body
    const validatedData = UpdateTaskBody.parse(body);

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { error: "NOTION_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    // Build properties object dynamically based on what's provided
    const properties: any = {};

    if (validatedData.title !== undefined) {
      properties.Task = {
        title: [{ text: { content: validatedData.title } }],
      };
    }

    if (validatedData.status !== undefined) {
      properties.Status = {
        select: { name: validatedData.status },
      };
    }

    if (validatedData.priority !== undefined) {
      properties.Priority = {
        select: { name: validatedData.priority },
      };
    }

    if (validatedData.context !== undefined) {
      properties.Context = {
        multi_select: validatedData.context.map(name => ({ name })),
      };
    }

    if (validatedData.dueDate !== undefined) {
      if (validatedData.dueDate === null) {
        properties["Due Date"] = { date: null };
      } else {
        properties["Due Date"] = {
          date: { start: validatedData.dueDate },
        };
      }
    }

    if (validatedData.tags !== undefined) {
      properties.Tags = {
        multi_select: validatedData.tags.map(name => ({ name })),
      };
    }

    // Update the task
    const response = await notion.pages.update({
      page_id: id,
      properties,
    });

    return NextResponse.json({
      success: true,
      pageId: response.id,
      message: "Task updated successfully",
      updated: validatedData,
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
