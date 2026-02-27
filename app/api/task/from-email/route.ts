import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/task/from-email
 *
 * Creates a task from email context. Accepts subject, sender, and optional body.
 * Uses Claude to extract the actionable task, priority, and due date from the email.
 * Tags with #email and source="Email".
 *
 * Called by: Apple Shortcut (Ctrl+Opt+E), browser bookmarklet, or direct API call.
 */

const RequestBody = z.object({
  subject: z.string().min(1).max(500),
  sender: z.string().optional().default("Unknown"),
  body: z.string().max(2000).optional().default(""),
  source: z.string().optional().default("Email"),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = RequestBody.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subject, sender, body, source } = parsed.data;

    // Use Claude to extract the actionable task from the email
    let taskTitle = subject;
    let priority = "medium";
    let dueDate: string | null = null;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const now = new Date();
        const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));

        const prompt = `Extract an actionable task from this email. Return ONLY JSON, no other text.

Email subject: "${subject}"
From: ${sender}
Body preview: ${body.substring(0, 500)}
Current date/time: ${sydneyTime.toISOString()}

Return:
{
  "title": "Clear actionable task title (imperative form, e.g. 'Review MSA from Telstra')",
  "priority": "urgent|high|medium|low",
  "dueDate": "ISO date string or null",
  "context": "Work|Client Projects|Legal Review|Admin"
}

Rules:
- Title should be actionable (start with a verb)
- Include the sender/company name if relevant
- If the email mentions a deadline, extract it as dueDate
- If it says "urgent", "ASAP", "EOD", set priority to "urgent"
- If it's a contract/legal matter, set context to "Legal Review"
- Keep the title under 100 characters`;

        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });

        const content = response.content[0];
        if (content.type === "text") {
          let jsonText = content.text.trim();
          if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
          }
          const parsed = JSON.parse(jsonText);
          taskTitle = parsed.title || subject;
          priority = parsed.priority || "medium";
          dueDate = parsed.dueDate || null;
        }
      } catch (aiError) {
        console.error("AI parsing failed, using subject as title:", aiError);
        // Fall back to using the email subject as the task title
      }
    }

    // Map priority to Prisma values
    const priorityMap: Record<string, string> = {
      urgent: "urgent",
      high: "high",
      medium: "medium",
      low: "low",
      Urgent: "urgent",
      Important: "high",
      Someday: "low",
    };

    // Create the task in Postgres
    const task = await prisma.task.create({
      data: {
        title: taskTitle,
        description: `From: ${sender}\nSubject: ${subject}${body ? '\n\n' + body.substring(0, 500) : ''}`,
        priority: priorityMap[priority] || "medium",
        status: "todo",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    // Add "email" tag
    const emailTag = await prisma.tag.upsert({
      where: { name: "email" },
      update: {},
      create: { name: "email" },
    });
    await prisma.taskTag.create({
      data: { taskId: task.id, tagId: emailTag.id },
    }).catch(() => {}); // Ignore if already exists

    // Add source tag
    const sourceTag = await prisma.tag.upsert({
      where: { name: source.toLowerCase() },
      update: {},
      create: { name: source.toLowerCase() },
    });
    await prisma.taskTag.create({
      data: { taskId: task.id, tagId: sourceTag.id },
    }).catch(() => {});

    // Fire-and-forget push notification
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://tomos-task-api.vercel.app";

    fetch(`${baseUrl}/api/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Email Task: ${taskTitle.substring(0, 50)}`,
        body: `From ${sender}`,
        task_id: task.id,
        priority,
        badge: 1,
      }),
    }).catch(() => {});

    console.log(`Email-to-task: "${taskTitle}" from ${sender} (${priority})`);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      title: taskTitle,
      priority,
      dueDate,
      source,
    });
  } catch (error) {
    console.error("Error creating task from email:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create task from email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
