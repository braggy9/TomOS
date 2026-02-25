import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";

const NOTION_DATABASE_ID = "739144099ebc4ba1ba619dd1a5a08d25";

interface NotionTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  context: string[];
  energy: string;
  time: string;
  dueDate: string | null;
}

async function getTasksForDigest(): Promise<NotionTask[]> {
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });

  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Query tasks that are:
  // 1. Not Done
  // 2. Either have no due date OR due date is today or overdue
  const response = await (notion.databases as any).query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      and: [
        {
          property: "Status",
          select: {
            does_not_equal: "Done",
          },
        },
        {
          or: [
            {
              property: "Due Date",
              date: {
                is_empty: true,
              },
            },
            {
              property: "Due Date",
              date: {
                on_or_before: today,
              },
            },
          ],
        },
      ],
    },
    sorts: [
      {
        property: "Priority",
        direction: "ascending",
      },
      {
        property: "Due Date",
        direction: "ascending",
      },
    ],
  });

  const tasks: NotionTask[] = response.results.map((page: any) => {
    const props = page.properties;

    return {
      id: page.id,
      title: props.Task?.title?.[0]?.plain_text || "Untitled",
      status: props.Status?.select?.name || "Unknown",
      priority: props.Priority?.select?.name || "Someday",
      context: props.Context?.multi_select?.map((c: any) => c.name) || [],
      energy: props.Energy?.select?.name || "Medium",
      time: props.Time?.select?.name || "Short",
      dueDate: props["Due Date"]?.date?.start || null,
    };
  });

  return tasks;
}

async function generateDigestContent(tasks: NotionTask[]): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `Generate a friendly, motivating daily digest email for the following tasks.

Tasks:
${JSON.stringify(tasks, null, 2)}

Format the email with:
- A warm greeting
- Summary of task count and breakdown by priority
- Grouped sections: Overdue (if any), Due Today (if any), and Other Active Tasks
- For each task, show: title, priority emoji, context, energy level, estimated time
- A motivating closing message

Keep it concise, actionable, and encouraging. Use emojis appropriately but not excessively.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Daily digest returns plain text, not JSON, so no stripping needed
  return content.text;
}

async function sendDigestEmail(emailContent: string): Promise<void> {
  // Using Resend API for email sending
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "TomOS Tasks <tasks@updates.tombragg.com>",
      to: [process.env.DIGEST_EMAIL_TO || "tom@tombragg.com"],
      subject: `Your Daily Task Digest - ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Australia/Sydney' })}`,
      html: emailContent.replace(/\n/g, '<br>'),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

export async function GET(req: Request) {
  try {
    // Verify this is a legitimate cron request from Vercel
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { error: "NOTION_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const tasks = await getTasksForDigest();

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tasks to digest",
        taskCount: 0,
      });
    }

    const emailContent = await generateDigestContent(tasks);
    await sendDigestEmail(emailContent);

    return NextResponse.json({
      success: true,
      message: "Daily digest sent successfully",
      taskCount: tasks.length,
    });
  } catch (error) {
    console.error("Error generating daily digest:", error);
    return NextResponse.json(
      {
        error: "Failed to generate daily digest",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
