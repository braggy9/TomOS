import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";

const NOTION_DATABASE_ID = "739144099ebc4ba1ba619dd1a5a08d25";

interface Task {
  title: string;
  priority: string;
  context: string[];
  energy: string;
  time: string;
  dueDate: string | null;
}

async function getActiveTasks(): Promise<Task[]> {
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });

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
      ],
    },
    sorts: [
      { property: "Priority", direction: "ascending" },
      { property: "Due Date", direction: "ascending" },
    ],
    page_size: 50,
  });

  return response.results.map((page: any) => {
    const props = page.properties;
    return {
      title: props.Task?.title?.[0]?.plain_text || "Untitled",
      priority: props.Priority?.select?.name || "Someday",
      context: props.Context?.multi_select?.map((c: any) => c.name) || [],
      energy: props.Energy?.select?.name || "Medium",
      time: props.Time?.select?.name || "Short",
      dueDate: props["Due Date"]?.date?.start || null,
    };
  });
}

async function generateSuggestions(tasks: Task[]): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const now = new Date();
  const sydneyTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Australia/Sydney" })
  );
  const currentHour = sydneyTime.getHours();
  const currentDay = sydneyTime.toLocaleDateString("en-AU", {
    weekday: "long",
  });

  // Time of day context
  let timeContext = "";
  if (currentHour < 12) {
    timeContext = "morning - people usually have high energy";
  } else if (currentHour < 17) {
    timeContext = "afternoon - energy may be moderate";
  } else {
    timeContext = "evening - energy is typically lower";
  }

  const prompt = `You are analyzing a task list for someone on ${currentDay} ${timeContext}.

Current tasks:
${JSON.stringify(tasks, null, 2)}

Provide smart, actionable suggestions including:
1. **Quick Wins**: Identify 2-3 tasks that are Quick + Low energy - perfect for right now
2. **Time-of-Day Match**: Suggest tasks that match the current time (${timeContext})
3. **Urgent Priorities**: Highlight any urgent or overdue items
4. **Task Sequencing**: Suggest an optimal order based on dependencies, energy, and time
5. **Break Recommendations**: If there are many high-energy tasks, suggest taking breaks
6. **Context Switching**: Warn if tasks require frequent context switches

Be concise, encouraging, and practical. Use emojis sparingly. Format as markdown.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return content.text;
}

export async function GET(req: Request) {
  try {
    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { error: "NOTION_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const tasks = await getActiveTasks();

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        taskCount: 0,
        suggestions: "🎉 You have no active tasks! Great job staying on top of things.",
      });
    }

    const suggestions = await generateSuggestions(tasks);

    // Calculate stats
    const stats = {
      total: tasks.length,
      urgent: tasks.filter((t) => t.priority === "Urgent").length,
      important: tasks.filter((t) => t.priority === "Important").length,
      quickWins: tasks.filter(
        (t) => t.time === "Quick" && t.energy === "Low"
      ).length,
      highEnergy: tasks.filter((t) => t.energy === "High").length,
      dueToday: tasks.filter((t) => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        const today = new Date();
        return dueDate.toDateString() === today.toDateString();
      }).length,
    };

    return NextResponse.json({
      success: true,
      taskCount: tasks.length,
      stats,
      suggestions,
    });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
