import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const RequestBody = z.object({
  task: z.string().min(1),
});

interface TaskAnalysis {
  isVague: boolean;
  vaguenessScore: number; // 0-10, higher = more vague
  vaguenessReasons: string[];
  suggestions: string[];
  breakdown: {
    suggestedTitle: string;
    suggestedSubtasks: string[];
    suggestedTags: string[];
    estimatedTime: string;
    estimatedEnergy: string;
  } | null;
}

async function analyzeTaskWithClaude(
  taskDescription: string
): Promise<TaskAnalysis> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `Analyze this task for clarity and actionability:

"${taskDescription}"

Evaluate the task and return a JSON object with:
- isVague: boolean - true if the task is vague, ambiguous, or not actionable
- vaguenessScore: number (0-10) - 0 = crystal clear, 10 = extremely vague
- vaguenessReasons: array of specific reasons why it's vague (empty if not vague)
- suggestions: array of specific suggestions to make it clearer
- breakdown: object or null
  - suggestedTitle: string - a clearer, more actionable title
  - suggestedSubtasks: array of specific, actionable subtasks
  - suggestedTags: array of relevant tags (without #)
  - estimatedTime: "Quick" | "Short" | "Long"
  - estimatedEnergy: "Low" | "Medium" | "High"

A task is vague if it:
- Lacks specific actions ("improve", "work on", "deal with", "handle")
- Has no clear completion criteria
- Is too broad ("organize everything", "fix all bugs")
- Missing important details (who, what, when, where)
- Uses ambiguous terms without context

A task is clear if it:
- Has a specific, measurable outcome
- Uses action verbs ("write", "send", "call", "review")
- Has clear completion criteria
- Is focused on a single objective

Examples:
- "Work on project" → isVague: true, vaguenessScore: 9 (no specific action, no completion criteria)
- "Send project proposal to John by Friday" → isVague: false, vaguenessScore: 1 (specific, actionable, has deadline)
- "Fix bugs" → isVague: true, vaguenessScore: 8 (too broad, no specific bugs mentioned)
- "Fix login button not responding on iOS app" → isVague: false, vaguenessScore: 2 (specific issue, clear target)

Return ONLY valid JSON, no markdown or explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Strip markdown code blocks if present
  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\s*\n/, "")
      .replace(/\n```\s*$/, "");
  }

  const analysis = JSON.parse(jsonText) as TaskAnalysis;
  return analysis;
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

    const { task } = parsed.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const analysis = await analyzeTaskWithClaude(task);

    return NextResponse.json({
      success: true,
      task,
      analysis,
      message: analysis.isVague
        ? "⚠️ This task could be more specific. See suggestions below."
        : "✅ This task is clear and actionable!",
    });
  } catch (error) {
    console.error("Error analyzing task:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
