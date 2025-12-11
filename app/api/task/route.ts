import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import cron from "node-cron";

const RequestBody = z.object({
  task: z.string().min(1),
  source: z.string().optional().default("Alfred"),
});

const NOTION_DATABASE_ID = "51ebe8dd-19a0-4f4e-9768-361c8872acdc";
const NTFY_TOPIC = "tomos-tasks-sufgocdozVo4nawcud";

interface ParsedTask {
  title: string;
  priority: "Urgent" | "Important" | "Someday";
  context: "Work" | "Client Projects" | "Strategy" | "Admin" | "Legal Review";
  energy: "Low" | "Medium" | "High";
  time: "Quick" | "Short" | "Long";
  dueDate: string | null;
}

async function parseTaskWithClaude(taskDescription: string): Promise<ParsedTask> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "proxy",
    baseURL: process.env.ANTHROPIC_PROXY_URL || "https://tomos-proxy.vercel.app/api/anthropic-proxy",
  });

  const prompt = `Parse the following task description and extract structured information. Return a JSON object with these fields:
- title: A clear, concise task title (string)
- priority: One of "Urgent", "Important", or "Someday" (string)
- context: One of "Work", "Client Projects", "Strategy", "Admin", or "Legal Review" (string)
- energy: One of "Low", "Medium", or "High" based on mental/physical effort required (string)
- time: One of "Quick" (< 15 min), "Short" (15-60 min), or "Long" (> 60 min) (string)
- dueDate: ISO 8601 date string in Sydney timezone (Australia/Sydney) if a due date is mentioned, or null if not mentioned

Task description: ${taskDescription}

Return ONLY valid JSON, no markdown or explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = JSON.parse(content.text) as ParsedTask;
  return parsed;
}

async function createNotionPage(parsedTask: ParsedTask, source: string): Promise<string> {
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });

  const now = new Date().toISOString();

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
        select: { name: parsedTask.context },
      },
      Energy: {
        select: { name: parsedTask.energy },
      },
      Time: {
        select: { name: parsedTask.time },
      },
      Source: {
        rich_text: [{ text: { content: source } }],
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
  });

  return response.id;
}

async function sendNtfyNotification(parsedTask: ParsedTask, notionPageId: string): Promise<void> {
  const notionUrl = `https://notion.so/${notionPageId.replace(/-/g, "")}`;

  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: NTFY_TOPIC,
      title: "New Task Created",
      message: `${parsedTask.title}\nPriority: ${parsedTask.priority}\nContext: ${parsedTask.context}`,
      tags: ["clipboard"],
      actions: [{ action: "view", label: "Open in Notion", url: notionUrl }],
    }),
  });
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
    const notionUrl = `https://notion.so/${notionPageId.replace(/-/g, "")}`;
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: NTFY_TOPIC,
        title: "⏰ Task Due Soon",
        message: `${parsedTask.title}\nDue in 15 minutes!`,
        priority: 4,
        tags: ["alarm_clock"],
        actions: [{ action: "view", label: "Open in Notion", url: notionUrl }],
      }),
    });
  });
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
    await sendNtfyNotification(parsedTask, notionPageId);
    scheduleReminder(parsedTask, notionPageId);

    return NextResponse.json({
      success: true,
      notionPageId,
      parsedTask,
      message: "Task created successfully",
    });
  } catch (error) {
    console.error("Error processing task:", error);
    return NextResponse.json(
      {
        error: "Failed to process task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
