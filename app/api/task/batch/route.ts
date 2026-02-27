import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

/**
 * Natural Language Batch Import
 *
 * Input: A brain dump of multiple tasks in natural language
 * Output: Multiple properly-tagged individual tasks in Postgres
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

async function createPostgresTask(parsedTask: ParsedTask, source: string): Promise<{ id: string; title: string }> {
  // Map parsed priority to Prisma priority
  const priorityMap: Record<string, string> = {
    'Urgent': 'urgent',
    'Important': 'high',
    'Someday': 'low',
  };
  const priority = priorityMap[parsedTask.priority] || 'medium';

  // Build description from subtasks, tags, and mentions
  const descriptionParts: string[] = [];

  if (parsedTask.subtasks.length > 0) {
    descriptionParts.push('Subtasks:\n' + parsedTask.subtasks.map((st) => `- ${st}`).join('\n'));
  }

  if (parsedTask.tags.length > 0) {
    descriptionParts.push('\nTags: ' + parsedTask.tags.map((t) => `#${t}`).join(', '));
  }

  if (parsedTask.mentions.length > 0) {
    descriptionParts.push('\nMentions: ' + parsedTask.mentions.map((m) => `@${m}`).join(', '));
  }

  // Create metadata tags
  const metadataTags: string[] = [
    `context:${parsedTask.context}`,
    `energy:${parsedTask.energy}`,
    `time:${parsedTask.time}`,
    `source:${source}`,
  ];

  // Merge all tags
  const allTags = [...new Set([...parsedTask.tags, ...metadataTags])];

  // Create task in Postgres
  const task = await prisma.task.create({
    data: {
      title: parsedTask.title,
      description: descriptionParts.join('\n') || null,
      status: 'todo',
      priority,
      dueDate: parsedTask.dueDate ? new Date(parsedTask.dueDate) : null,
    },
  });

  // Create or connect tags
  for (const tagName of allTags) {
    const tag = await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    });

    await prisma.taskTag.create({
      data: {
        taskId: task.id,
        tagId: tag.id,
      },
    });
  }

  return { id: task.id, title: task.title };
}

export async function POST(req: NextRequest) {
  try {
    console.log('[BATCH] Version: 2025-12-31-v2 - Starting batch import');
    const json = await req.json();
    const parsed = RequestBody.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tasks, source } = parsed.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Missing ANTHROPIC_API_KEY' },
        { status: 500 }
      );
    }

    // Parse the batch input
    console.log('[BATCH] Parsing batch tasks...');
    const parsedTasks = await parseBatchTasks(tasks);
    console.log(`[BATCH] Parsed ${parsedTasks.length} tasks`);

    if (parsedTasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks detected in input' },
        { status: 400 }
      );
    }

    console.log('[BATCH] Creating tasks in Postgres...');
    const createdTasks = await Promise.all(
      parsedTasks.map(async (task, index) => {
        console.log(`[BATCH] Creating task ${index + 1}/${parsedTasks.length}: ${task.title}`);
        const result = await createPostgresTask(task, source);
        console.log(`[BATCH] Created task ${index + 1} with ID: ${result.id}`);
        return {
          taskId: result.id,
          title: result.title,
          priority: task.priority,
          dueDate: task.dueDate,
        };
      })
    );

    // Send APNs push notification for batch import
    console.log('[BATCH] Sending APNs notification...');
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://tomos-task-api.vercel.app';

      await fetch(`${baseUrl}/api/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${createdTasks.length} Tasks Captured`,
          body: createdTasks.map((t) => t.title).join(', '),
          badge: createdTasks.length,
        }),
      });
    } catch (error) {
      console.error('[BATCH] Failed to send push notification:', error);
    }

    console.log(`[BATCH] Batch import: Created ${createdTasks.length} tasks in Postgres`);

    return NextResponse.json({
      success: true,
      taskCount: createdTasks.length,
      tasks: createdTasks,
      message: `Successfully created ${createdTasks.length} tasks from batch input`,
      source: 'postgres',
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
