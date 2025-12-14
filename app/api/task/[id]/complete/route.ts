import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    return NextResponse.json({
      success: true,
      pageId: response.id,
      message: "Task marked as complete",
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
