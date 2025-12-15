import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";

const NOTION_DATABASE_ID = "739144099ebc4ba1ba619dd1a5a08d25";

const RequestBody = z.object({
  query: z.string().min(1),
});

interface QueryFilters {
  status?: string[];
  priority?: string[];
  context?: string[];
  hasDeadline?: boolean;
  dateFilter?: "today" | "tomorrow" | "this_week" | "overdue" | "upcoming";
  energy?: string[];
  time?: string[];
}

async function parseQueryWithClaude(query: string): Promise<QueryFilters> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `Parse the following natural language query about tasks and extract filter criteria. Return a JSON object with these fields (all optional):

- status: Array of status values to filter by. Options: ["Inbox", "Todo", "In Progress", "Done", "Blocked"]. Empty array means no status filter.
- priority: Array of priority values. Options: ["Urgent", "Important", "Someday"]. Empty array means no priority filter.
- context: Array of context values. Options: ["Work", "Client Projects", "Strategy", "Admin", "Legal Review"]. Empty array means no context filter.
- hasDeadline: Boolean - true if query asks for tasks with deadlines, false for tasks without deadlines, undefined/null for no deadline filter.
- dateFilter: One of "today", "tomorrow", "this_week", "overdue", "upcoming", or null if no date filter.
- energy: Array of energy levels. Options: ["Low", "Medium", "High"]. Empty array means no energy filter.
- time: Array of time estimates. Options: ["Quick", "Short", "Long"]. Empty array means no time filter.

Examples:
- "show me urgent tasks" → {"priority": ["Urgent"]}
- "what's due today" → {"dateFilter": "today"}
- "find work tasks that are in progress" → {"context": ["Work"], "status": ["In Progress"]}
- "show overdue tasks" → {"dateFilter": "overdue"}
- "quick tasks with low energy" → {"time": ["Quick"], "energy": ["Low"]}
- "client projects not done yet" → {"context": ["Client Projects"], "status": ["Inbox", "Todo", "In Progress", "Blocked"]}
- "all tasks" → {}

Query: ${query}

Return ONLY valid JSON, no markdown or explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = JSON.parse(content.text) as QueryFilters;
  return parsed;
}

function buildNotionFilter(filters: QueryFilters): any {
  const conditions: any[] = [];

  // Status filter
  if (filters.status && filters.status.length > 0) {
    if (filters.status.length === 1) {
      conditions.push({
        property: "Status",
        select: { equals: filters.status[0] },
      });
    } else {
      conditions.push({
        or: filters.status.map((status) => ({
          property: "Status",
          select: { equals: status },
        })),
      });
    }
  }

  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
    if (filters.priority.length === 1) {
      conditions.push({
        property: "Priority",
        select: { equals: filters.priority[0] },
      });
    } else {
      conditions.push({
        or: filters.priority.map((priority) => ({
          property: "Priority",
          select: { equals: priority },
        })),
      });
    }
  }

  // Context filter
  if (filters.context && filters.context.length > 0) {
    conditions.push({
      or: filters.context.map((context) => ({
        property: "Context",
        multi_select: { contains: context },
      })),
    });
  }

  // Energy filter
  if (filters.energy && filters.energy.length > 0) {
    if (filters.energy.length === 1) {
      conditions.push({
        property: "Energy",
        select: { equals: filters.energy[0] },
      });
    } else {
      conditions.push({
        or: filters.energy.map((energy) => ({
          property: "Energy",
          select: { equals: energy },
        })),
      });
    }
  }

  // Time filter
  if (filters.time && filters.time.length > 0) {
    if (filters.time.length === 1) {
      conditions.push({
        property: "Time",
        select: { equals: filters.time[0] },
      });
    } else {
      conditions.push({
        or: filters.time.map((time) => ({
          property: "Time",
          select: { equals: time },
        })),
      });
    }
  }

  // Deadline filter
  if (filters.hasDeadline === true) {
    conditions.push({
      property: "Due Date",
      date: { is_not_empty: true },
    });
  } else if (filters.hasDeadline === false) {
    conditions.push({
      property: "Due Date",
      date: { is_empty: true },
    });
  }

  // Date-based filters
  if (filters.dateFilter) {
    const now = new Date();
    const today = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    today.setHours(0, 0, 0, 0);

    switch (filters.dateFilter) {
      case "today": {
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        conditions.push({
          and: [
            {
              property: "Due Date",
              date: { on_or_after: today.toISOString().split("T")[0] },
            },
            {
              property: "Due Date",
              date: { on_or_before: todayEnd.toISOString().split("T")[0] },
            },
          ],
        });
        break;
      }
      case "tomorrow": {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);
        conditions.push({
          and: [
            {
              property: "Due Date",
              date: { on_or_after: tomorrow.toISOString().split("T")[0] },
            },
            {
              property: "Due Date",
              date: { on_or_before: tomorrowEnd.toISOString().split("T")[0] },
            },
          ],
        });
        break;
      }
      case "this_week": {
        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        conditions.push({
          and: [
            {
              property: "Due Date",
              date: { on_or_after: today.toISOString().split("T")[0] },
            },
            {
              property: "Due Date",
              date: { on_or_before: endOfWeek.toISOString().split("T")[0] },
            },
          ],
        });
        break;
      }
      case "overdue": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        conditions.push({
          and: [
            {
              property: "Due Date",
              date: { on_or_before: yesterday.toISOString().split("T")[0] },
            },
            {
              property: "Status",
              select: { does_not_equal: "Done" },
            },
          ],
        });
        break;
      }
      case "upcoming": {
        conditions.push({
          property: "Due Date",
          date: { on_or_after: today.toISOString().split("T")[0] },
        });
        break;
      }
    }
  }

  if (conditions.length === 0) {
    return undefined;
  } else if (conditions.length === 1) {
    return conditions[0];
  } else {
    return { and: conditions };
  }
}

async function queryNotionDatabase(filters: QueryFilters): Promise<any[]> {
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });

  const filter = buildNotionFilter(filters);

  const queryParams: any = {
    database_id: NOTION_DATABASE_ID,
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
  };

  if (filter) {
    queryParams.filter = filter;
  }

  const response = await (notion.databases as any).query(queryParams);

  return response.results.map((page: any) => {
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
      url: `https://notion.so/${page.id.replace(/-/g, "")}`,
    };
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

    const { query } = parsed.data;

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

    const filters = await parseQueryWithClaude(query);
    const tasks = await queryNotionDatabase(filters);

    return NextResponse.json({
      success: true,
      query,
      filters,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Error querying tasks:", error);
    return NextResponse.json(
      {
        error: "Failed to query tasks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
