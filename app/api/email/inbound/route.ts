import { NextResponse } from "next/server";
import { z } from "zod";

// Resend webhook payload for inbound emails
const InboundEmailSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = InboundEmailSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { from, subject, text, html } = parsed.data;

    // Extract task from email body or subject
    const taskText = text || html?.replace(/<[^>]*>/g, "") || subject;

    if (!taskText.trim()) {
      return NextResponse.json(
        { error: "No task content found in email" },
        { status: 400 }
      );
    }

    // Create task using existing endpoint
    const taskResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/task`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: taskText,
          source: `Email (${from})`,
        }),
      }
    );

    if (!taskResponse.ok) {
      throw new Error("Failed to create task from email");
    }

    const taskResult = await taskResponse.json();

    return NextResponse.json({
      success: true,
      message: "Task created from email",
      from,
      subject,
      notionPageId: taskResult.notionPageId,
      parsedTask: taskResult.parsedTask,
    });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return NextResponse.json(
      {
        error: "Failed to process email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
