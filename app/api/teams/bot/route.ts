import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

interface TeamsActivity {
  type: string;
  text?: string;
  value?: any;
  from?: {
    id: string;
    name: string;
  };
  conversation?: {
    id: string;
    conversationType: string;
  };
  channelData?: any;
}

interface TeamsResponse {
  type: string;
  text?: string;
  attachments?: any[];
}

export async function POST(request: NextRequest) {
  try {
    const activity: TeamsActivity = await request.json();

    console.log('Teams activity received:', JSON.stringify(activity, null, 2));

    // Handle different activity types
    switch (activity.type) {
      case 'message':
        return await handleMessage(activity);

      case 'invoke':
        return await handleInvoke(activity);

      default:
        return NextResponse.json({ type: 'message', text: 'Activity type not supported' });
    }
  } catch (error) {
    console.error('Error processing Teams activity:', error);
    return NextResponse.json(
      { error: 'Failed to process Teams activity' },
      { status: 500 }
    );
  }
}

async function handleMessage(activity: TeamsActivity): Promise<NextResponse> {
  const text = activity.text?.trim() || '';
  const userName = activity.from?.name || 'Unknown User';

  // Handle slash commands
  if (text.startsWith('/')) {
    return await handleSlashCommand(text, userName);
  }

  // Handle direct message to bot
  if (activity.conversation?.conversationType === 'personal') {
    return await handleDirectMessage(text, userName);
  }

  // Default response for @ mentions in channels
  return NextResponse.json({
    type: 'message',
    text: `Hi! Use \`/task\` to create a task, or DM me directly. Try:\n\n• \`/task Buy milk tomorrow at 10am\`\n• \`/tasks\` to see today's tasks\n• \`/query urgent tasks\`\n• \`/help\` for more info`
  });
}

async function handleSlashCommand(text: string, userName: string): Promise<NextResponse> {
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/task':
      if (!args) {
        return NextResponse.json({
          type: 'message',
          text: '❌ Please provide task details.\n\nExample: `/task Review contract by Friday 5pm`'
        });
      }
      return await createTask(args, 'Microsoft Teams', userName);

    case '/tasks':
      return await getTodaysTasks();

    case '/query':
      if (!args) {
        return NextResponse.json({
          type: 'message',
          text: '❌ Please provide search query.\n\nExample: `/query urgent tasks`'
        });
      }
      return await queryTasks(args);

    case '/help':
      return await showHelp();

    default:
      return NextResponse.json({
        type: 'message',
        text: `❌ Unknown command: ${command}\n\nTry \`/help\` to see available commands.`
      });
  }
}

async function handleDirectMessage(text: string, userName: string): Promise<NextResponse> {
  // Handle natural language in DMs
  const lowerText = text.toLowerCase();

  if (lowerText.includes('help') || lowerText === 'hi' || lowerText === 'hello') {
    return await showHelp();
  }

  if (lowerText.startsWith('show') || lowerText.startsWith('list') || lowerText.includes('my tasks')) {
    return await getTodaysTasks();
  }

  if (lowerText.startsWith('find') || lowerText.startsWith('search') || lowerText.startsWith('query')) {
    const query = text.replace(/^(find|search|query)\s+/i, '');
    return await queryTasks(query);
  }

  // Default: treat as task creation
  return await createTask(text, 'Microsoft Teams DM', userName);
}

async function handleInvoke(activity: TeamsActivity): Promise<NextResponse> {
  // Handle message actions (right-click menu)
  const value = activity.value;

  if (value?.commandId === 'createTask') {
    const messageText = value?.messagePayload?.body?.content || value?.taskContent || '';
    const userName = activity.from?.name || 'Unknown User';

    if (!messageText) {
      return NextResponse.json({
        type: 'message',
        text: '❌ No message content found to create task.'
      });
    }

    return await createTask(messageText, 'Microsoft Teams Message Action', userName);
  }

  if (value?.commandId === 'quickTask') {
    const taskText = value?.data?.taskText || value?.taskText || '';
    const userName = activity.from?.name || 'Unknown User';

    if (!taskText) {
      return NextResponse.json({
        type: 'message',
        text: '❌ Please provide task details.'
      });
    }

    return await createTask(taskText, 'Microsoft Teams Quick Task', userName);
  }

  return NextResponse.json({
    type: 'message',
    text: 'Invoke action not supported'
  });
}

async function createTask(taskText: string, source: string, userName: string): Promise<NextResponse> {
  try {
    // Call the existing task API endpoint
    const apiUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/task`
      : 'https://tomos-task-api.vercel.app/api/task';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: taskText,
        source: `${source} (@${userName})`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Task API returned ${response.status}`);
    }

    const result = await response.json();
    const parsedTask = result.parsedTask;

    // Format response card
    const cardText = `✅ **Task Created!**\n\n**Title:** ${parsedTask.title}\n` +
      (parsedTask.dueDate ? `**Due:** ${new Date(parsedTask.dueDate).toLocaleString()}\n` : '') +
      (parsedTask.priority ? `**Priority:** ${parsedTask.priority}\n` : '') +
      (parsedTask.context ? `**Context:** ${parsedTask.context}\n` : '') +
      (parsedTask.tags && parsedTask.tags.length > 0 ? `**Tags:** ${parsedTask.tags.join(', ')}\n` : '') +
      (parsedTask.subtasks && parsedTask.subtasks.length > 0
        ? `**Subtasks:** ${parsedTask.subtasks.length} items\n`
        : '') +
      `\n[View in Notion](https://notion.so/${NOTION_DATABASE_ID.replace(/-/g, '')})`;

    return NextResponse.json({
      type: 'message',
      text: cardText
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({
      type: 'message',
      text: `❌ Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function getTodaysTasks(): Promise<NextResponse> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Status',
            status: {
              does_not_equal: 'Done',
            },
          },
          {
            property: 'Due Date',
            date: {
              on_or_after: today.toISOString(),
              before: tomorrow.toISOString(),
            },
          },
        ],
      },
      sorts: [
        {
          property: 'Due Date',
          direction: 'ascending',
        },
      ],
    });

    if (response.results.length === 0) {
      return NextResponse.json({
        type: 'message',
        text: '✅ No tasks due today! You\'re all caught up.'
      });
    }

    const taskList = response.results.map((page: any, index) => {
      const title = page.properties.Task?.title?.[0]?.plain_text || 'Untitled';
      const priority = page.properties.Priority?.select?.name || '';
      const context = page.properties.Context?.select?.name || '';

      return `${index + 1}. **${title}**${priority ? ` [${priority}]` : ''}${context ? ` (${context})` : ''}`;
    }).join('\n');

    const text = `📋 **Tasks Due Today (${response.results.length})**\n\n${taskList}\n\n[View in Notion](https://notion.so/${NOTION_DATABASE_ID.replace(/-/g, '')})`;

    return NextResponse.json({
      type: 'message',
      text
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({
      type: 'message',
      text: '❌ Failed to fetch tasks'
    });
  }
}

async function queryTasks(query: string): Promise<NextResponse> {
  try {
    // Call the existing query API
    const apiUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/tasks/query`
      : 'https://tomos-task-api.vercel.app/api/tasks/query';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Query API returned ${response.status}`);
    }

    const result = await response.json();

    if (result.tasks.length === 0) {
      return NextResponse.json({
        type: 'message',
        text: `🔍 No tasks found matching: "${query}"`
      });
    }

    const taskList = result.tasks.slice(0, 10).map((task: any, index: number) => {
      return `${index + 1}. **${task.title}**${task.priority ? ` [${task.priority}]` : ''}${task.dueDate ? ` (Due: ${new Date(task.dueDate).toLocaleDateString()})` : ''}`;
    }).join('\n');

    const text = `🔍 **Search Results for "${query}"** (${result.tasks.length} found)\n\n${taskList}${result.tasks.length > 10 ? '\n\n_Showing first 10 results_' : ''}\n\n[View all in Notion](https://notion.so/${NOTION_DATABASE_ID.replace(/-/g, '')})`;

    return NextResponse.json({
      type: 'message',
      text
    });
  } catch (error) {
    console.error('Error querying tasks:', error);
    return NextResponse.json({
      type: 'message',
      text: '❌ Failed to query tasks'
    });
  }
}

async function showHelp(): Promise<NextResponse> {
  const helpText = `🤖 **TomOS Task Bot - Help**

**Slash Commands:**
• \`/task <details>\` - Create a new task
  Example: \`/task Review contract by Friday 5pm #urgent @legal\`

• \`/tasks\` - Show tasks due today

• \`/query <search>\` - Search your tasks
  Example: \`/query urgent client tasks\`

• \`/help\` - Show this help message

**Direct Message:**
Just send me a message and I'll create a task!
  Example: "Buy groceries tomorrow at 10am"

**Message Actions:**
Right-click any message → More actions → "Create Task from Message"

**Natural Language:**
I understand natural dates and times:
• "tomorrow at 2pm"
• "next Monday"
• "Friday 5pm"
• "in 2 hours"

Subtasks with bullets:
• "Prepare presentation
  - Create slides
  - Review data
  - Rehearse"

Tags and mentions:
• #urgent #review
• @team @client

**Powered by Claude Sonnet 4.5** 🧠

[Visit Dashboard](https://tomos-task-api.vercel.app)`;

  return NextResponse.json({
    type: 'message',
    text: helpText
  });
}
