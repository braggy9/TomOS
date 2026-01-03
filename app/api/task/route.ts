import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import cron from "node-cron";

const RequestBody = z.object({
  task: z.string().min(1),
  source: z.string().optional().default("Alfred"),
});

const NOTION_DATABASE_ID = "739144099ebc4ba1ba619dd1a5a08d25";

interface ParsedTask {
  title: string;
  priority: "Urgent" | "Important" | "Someday";
  context: "Work" | "Client Projects" | "Strategy" | "Admin" | "Legal Review";
  energy: "Low" | "Medium" | "High";
  time: "Quick" | "Short" | "Long";
  dueDate: string | null;
  subtasks: string[];
  tags: string[];
  mentions: string[];
}

async function parseTaskWithClaude(taskDescription: string): Promise<ParsedTask> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Get current date/time in Sydney timezone for relative date parsing
  const now = new Date();
  const sydneyTime = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
  const currentDateTime = sydneyTime.toISOString();

  const prompt = `You are parsing a task on ${currentDateTime} (Sydney timezone). Parse the following task description and extract structured information. Return a JSON object with these fields:
- title: A clear, concise task title (string) - remove any subtask bullets, tags, or mentions from the main title
- priority: One of "Urgent", "Important", or "Someday" (string)
- context: One of "Work", "Client Projects", "Strategy", "Admin", or "Legal Review" (string)
- energy: One of "Low", "Medium", or "High" based on mental/physical effort required (string)
- time: One of "Quick" (< 15 min), "Short" (15-60 min), or "Long" (> 60 min) (string)
- dueDate: ISO 8601 date string in Sydney timezone (Australia/Sydney) if a due date is mentioned. Handle relative dates like "tomorrow", "next week", "Friday", etc. based on the current date/time provided above. Return null if no due date/time is mentioned
- subtasks: Array of subtask strings extracted from bullet points (-, *, •) or numbered lists (1., 2., etc.). Empty array if none. (array of strings)
- tags: Array of hashtags found in the task description (e.g., #urgent, #review). Extract without the # symbol. Empty array if none. (array of strings)
- mentions: Array of @mentions found (e.g., @john, @sarah). Extract without the @ symbol. Empty array if none. (array of strings)

Examples:
- "Review contract #urgent @legal - Check clauses - Verify signatures" → subtasks: ["Check clauses", "Verify signatures"], tags: ["urgent"], mentions: ["legal"]
- "Call dentist tomorrow" → subtasks: [], tags: [], mentions: []

Task description: ${taskDescription}

Return ONLY valid JSON, no markdown or explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Strip markdown code blocks if present (```json ... ```)
  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
  }

  const parsed = JSON.parse(jsonText) as ParsedTask;
  return parsed;
}

async function createNotionPage(parsedTask: ParsedTask, source: string): Promise<string> {
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });

  console.log('Creating Notion page with database ID:', NOTION_DATABASE_ID);
  console.log('Parsed task:', JSON.stringify(parsedTask, null, 2));

  // Test database access first
  try {
    const dbInfo = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
    console.log('Database retrieved successfully:', dbInfo.id);
  } catch (dbError) {
    console.error('Failed to retrieve database:', dbError);
    throw new Error(`Database access failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
  }

  const now = new Date().toISOString();

  // Build page content (children blocks) for subtasks, tags, and mentions
  const children: any[] = [];

  // Add tags if present
  if (parsedTask.tags.length > 0) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: "Tags: " },
            annotations: { bold: true },
          },
          {
            type: "text",
            text: { content: parsedTask.tags.map(tag => `#${tag}`).join(", ") },
          },
        ],
      },
    });
  }

  // Add mentions if present
  if (parsedTask.mentions.length > 0) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: "Mentions: " },
            annotations: { bold: true },
          },
          {
            type: "text",
            text: { content: parsedTask.mentions.map(mention => `@${mention}`).join(", ") },
          },
        ],
      },
    });
  }

  // Add subtasks as to-do blocks
  if (parsedTask.subtasks.length > 0) {
    children.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: "Subtasks" } }],
      },
    });

    parsedTask.subtasks.forEach((subtask) => {
      children.push({
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: subtask } }],
          checked: false,
        },
      });
    });
  }

  const response = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Task: {
        title: [{ text: { content: parsedTask.title } }],
      },
      Status: {
        select: { name: "Inbox" },
      },
      Priority: {
        select: { name: parsedTask.priority },
      },
      Context: {
        multi_select: [{ name: parsedTask.context }],
      },
      Energy: {
        select: { name: parsedTask.energy },
      },
      Time: {
        select: { name: parsedTask.time },
      },
      Source: {
        select: { name: source },
      },
      ...(parsedTask.dueDate
        ? {
            "Due Date": {
              date: { start: parsedTask.dueDate },
            },
          }
        : {}),
      Captured: {
        date: { start: now },
      },
    },
    ...(children.length > 0 ? { children } : {}),
  });

  return response.id;
}

// ntfy removed - using APNs push notifications exclusively

async function syncTaskToCalendar(notionPageId: string, parsedTask: ParsedTask): Promise<void> {
  // Only sync if task has a due date and calendar is configured
  if (!parsedTask.dueDate) {
    console.log('Skipping calendar sync: no due date');
    return;
  }

  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!refreshToken) {
    console.log('Skipping calendar sync: Google Calendar not configured');
    return;
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tomos-task-api.vercel.app';

    const response = await fetch(`${baseUrl}/api/calendar/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncOne',
        taskId: notionPageId,
        refreshToken,
      }),
    });

    if (response.ok) {
      console.log('Task synced to Google Calendar:', notionPageId);
    } else {
      const error = await response.json();
      console.error('Failed to sync task to calendar:', error);
    }
  } catch (error) {
    console.error('Error syncing task to calendar:', error);
    // Don't throw - calendar sync failure shouldn't block task creation
  }
}

function scheduleReminder(parsedTask: ParsedTask, notionPageId: string): void {
  if (!parsedTask.dueDate) return;

  const dueDate = new Date(parsedTask.dueDate);
  const reminderTime = new Date(dueDate.getTime() - 15 * 60 * 1000);
  const now = new Date();

  if (reminderTime <= now) return;

  const sydneyTime = new Date(
    reminderTime.toLocaleString("en-US", { timeZone: "Australia/Sydney" })
  );

  const minute = sydneyTime.getMinutes();
  const hour = sydneyTime.getHours();
  const dayOfMonth = sydneyTime.getDate();
  const month = sydneyTime.getMonth() + 1;

  const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

  cron.schedule(cronExpression, async () => {
    // Send APNs push notification for task reminder
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://tomos-task-api.vercel.app';

      await fetch(`${baseUrl}/api/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Task Due Soon',
          body: `${parsedTask.title}\nDue in 15 minutes!`,
          task_id: notionPageId,
          priority: 'urgent',
          badge: 1,
        }),
      });
      console.log(`Reminder sent for task: ${parsedTask.title}`);
    } catch (error) {
      console.error('Failed to send reminder push:', error);
    }
  });
}

/**
 * Sends APNs push notification to all registered iOS/macOS devices.
 * This notifies users when a new task is created.
 *
 * @param parsedTask - The parsed task details
 * @param notionPageId - The Notion page ID for deep linking
 */
async function sendAPNsPushNotification(parsedTask: ParsedTask, notionPageId: string): Promise<void> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tomos-task-api.vercel.app';

    console.log('📱 Sending APNs push notification for new task...');

    const response = await fetch(`${baseUrl}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '📋 New Task Created',
        body: parsedTask.title,
        task_id: notionPageId,
        priority: parsedTask.priority.toLowerCase(),
        badge: 1,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ APNs push sent to ${result.sent_to} device(s)`);
    } else {
      const error = await response.json();
      console.error('⚠️ APNs push failed:', error);
    }
  } catch (error) {
    console.error('❌ Error sending APNs push:', error);
    // Don't throw - push notification failure shouldn't block task creation
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = RequestBody.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { task, source } = parsed.data;

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { error: "NOTION_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const parsedTask = await parseTaskWithClaude(task);
    const notionPageId = await createNotionPage(parsedTask, source);
    scheduleReminder(parsedTask, notionPageId);

    // Auto-sync to calendar (don't await - run in background)
    syncTaskToCalendar(notionPageId, parsedTask).catch(err =>
      console.error('Background calendar sync error:', err)
    );

    // Send APNs push notification to iOS/macOS devices (don't await - run in background)
    sendAPNsPushNotification(parsedTask, notionPageId).catch(err =>
      console.error('Background APNs push error:', err)
    );

    return NextResponse.json({
      success: true,
      notionPageId,
      parsedTask,
      message: "Task created successfully",
    });
  } catch (error) {
    console.error("Error processing task:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        error: "Failed to process task",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
