import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@notionhq/client';

const NOTION_DATABASE_ID = '739144099ebc4ba1ba619dd1a5a08d25';
const NTFY_TOPIC = 'tomos-tasks-sufgocdozVo4nawcud';

/**
 * Natural Language Batch Import
 *
 * Input: A brain dump of multiple tasks in natural language
 * Output: Multiple properly-tagged individual tasks in Notion
 *
 * Example:
 * "dentist tomorrow, review contract #urgent @john, prep slides for friday, book flights to sydney"
 * → Creates 4 separate tasks with proper metadata
 */

const RequestBody = z.object({
  tasks: z.string().min(1),
  source: z.string().optional().default('Batch Import'),
});

interface ParsedTask {
  title: string;
  priority: 'Urgent' | 'Important' | 'Someday';
  context: 'Work' | 'Client Projects' | 'Strategy' | 'Admin' | 'Legal Review';
  energy: 'Low' | 'Medium' | 'High';
  time: 'Quick' | 'Short' | 'Long';
  dueDate: string | null;
  subtasks: string[];
  tags: string[];
  mentions: string[];
}

async function parseBatchTasks(batchInput: string): Promise<ParsedTask[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Get current date/time in Sydney timezone
  const now = new Date();
  const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  const currentDateTime = sydneyTime.toISOString();

  const prompt = `You are parsing a batch task input on ${currentDateTime} (Sydney timezone).

The user provided a brain dump of multiple tasks. Break this into individual tasks and extract structured information for each.

Input: "${batchInput}"

For each task, return a JSON object with:
- title: Clear, concise task title (string)
- priority: "Urgent", "Important", or "Someday" (string)
- context: "Work", "Client Projects", "Strategy", "Admin", or "Legal Review" (string)
- energy: "Low", "Medium", or "High" (string)
- time: "Quick" (< 15 min), "Short" (15-60 min), or "Long" (> 60 min) (string)
- dueDate: ISO 8601 date string in Sydney timezone if mentioned, else null
- subtasks: Array of subtask strings (empty array if none)
- tags: Array of hashtags found (without #)
- mentions: Array of @mentions found (without @)

Return ONLY a JSON array of task objects. No markdown, no explanation.

Example:
Input: "call dentist tomorrow, review contract #urgent @john"
Output: [
  {
    "title": "Call dentist",
    "priority": "Important",
    "context": "Admin",
    "energy": "Low",
    "time": "Quick",
    "dueDate": "2025-12-20T09:00:00+11:00",
    "subtasks": [],
    "tags": [],
    "mentions": []
  },
  {
    "title": "Review contract",
    "priority": "Urgent",
    "context": "Legal Review",
    "energy": "High",
    "time": "Long",
    "dueDate": null,
    "subtasks": [],
    "tags": ["urgent"],
    "mentions": ["john"]
  }
]`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Strip markdown code blocks if present
  let jsonText = content.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  }

  const parsed = JSON.parse(jsonText) as ParsedTask[];
  return parsed;
}

async function createNotionPage(parsedTask: ParsedTask, source: string): Promise<string> {
  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });

  const now = new Date().toISOString();

  // Build page content (children blocks) for tags and mentions
  const children: any[] = [];

  // Add tags if present
  if (parsedTask.tags.length > 0) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Tags: ' },
            annotations: { bold: true },
          },
          {
            type: 'text',
            text: { content: parsedTask.tags.map((tag) => `#${tag}`).join(', ') },
          },
        ],
      },
    });
  }

  // Add mentions if present
  if (parsedTask.mentions.length > 0) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Mentions: ' },
            annotations: { bold: true },
          },
          {
            type: 'text',
            text: { content: parsedTask.mentions.map((m) => `@${m}`).join(', ') },
          },
        ],
      },
    });
  }

  // Add subtasks if present
  if (parsedTask.subtasks.length > 0) {
    children.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Subtasks' } }],
      },
    });

    parsedTask.subtasks.forEach((subtask) => {
      children.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{ type: 'text', text: { content: subtask } }],
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
        select: { name: 'Inbox' },
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
            'Due Date': {
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

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = RequestBody.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tasks, source } = parsed.data;

    if (!process.env.NOTION_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Missing API keys' },
        { status: 500 }
      );
    }

    // Parse the batch input
    const parsedTasks = await parseBatchTasks(tasks);

    if (parsedTasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks detected in input' },
        { status: 400 }
      );
    }

    // Create all tasks in Notion
    const createdTasks = await Promise.all(
      parsedTasks.map(async (task) => {
        const pageId = await createNotionPage(task, source);
        return {
          pageId,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
        };
      })
    );

    // Send batch notification
    const notionUrl = `https://notion.so/${NOTION_DATABASE_ID.replace(/-/g, '')}`;
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        Title: `✅ ${createdTasks.length} Tasks Captured`,
        Click: notionUrl,
        Tags: 'white_check_mark,sparkles',
      },
      body: createdTasks.map((t) => `• ${t.title}`).join('\n'),
    });

    console.log(`Batch import: Created ${createdTasks.length} tasks`);

    return NextResponse.json({
      success: true,
      taskCount: createdTasks.length,
      tasks: createdTasks,
      message: `Successfully created ${createdTasks.length} tasks from batch input`,
    });
  } catch (error) {
    console.error('Error processing batch tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to process batch tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
