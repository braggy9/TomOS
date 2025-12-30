import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const NOTION_DATABASE_ID = '739144099ebc4ba1ba619dd1a5a08d25';

/**
 * Focus Mode Context Mapping
 * Maps macOS Focus Modes to task contexts and priorities
 */
const FOCUS_MODE_FILTERS: Record<
  string,
  {
    contexts?: string[];
    priorities?: string[];
    description: string;
  }
> = {
  Work: {
    contexts: ['Work', 'Client Projects', 'Legal Review'],
    description: 'Work-related tasks and client projects',
  },
  Personal: {
    contexts: ['Admin', 'Strategy'],
    description: 'Personal and strategic tasks',
  },
  'Do Not Disturb': {
    priorities: ['Urgent'],
    description: 'Only urgent tasks',
  },
  Sleep: {
    contexts: [],
    description: 'No tasks - focus on rest',
  },
  None: {
    description: 'All tasks (no Focus Mode active)',
  },
};

async function getCurrentFocusMode(): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tomos-task-api.vercel.app';

    const response = await fetch(`${baseUrl}/api/focus/state`);
    if (!response.ok) return 'None';

    const data = await response.json();
    return data.focusMode || 'None';
  } catch (error) {
    console.error('Error fetching Focus Mode:', error);
    return 'None';
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { error: 'NOTION_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    // Get current Focus Mode
    const focusMode = await getCurrentFocusMode();
    const filter = FOCUS_MODE_FILTERS[focusMode] || FOCUS_MODE_FILTERS['None'];

    console.log(`Fetching tasks for Focus Mode: ${focusMode}`);

    // If Sleep mode, return empty tasks
    if (focusMode === 'Sleep') {
      return NextResponse.json({
        focusMode,
        description: filter.description,
        tasks: [],
        count: 0,
      });
    }

    // Build Notion filter based on Focus Mode
    const notionFilters: any[] = [
      {
        property: 'Status',
        select: {
          does_not_equal: 'Done',
        },
      },
    ];

    // Add context filter if specified
    if (filter.contexts && filter.contexts.length > 0) {
      notionFilters.push({
        or: filter.contexts.map((context) => ({
          property: 'Context',
          multi_select: {
            contains: context,
          },
        })),
      });
    }

    // Add priority filter if specified
    if (filter.priorities && filter.priorities.length > 0) {
      notionFilters.push({
        or: filter.priorities.map((priority) => ({
          property: 'Priority',
          select: {
            equals: priority,
          },
        })),
      });
    }

    // Query Notion database
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter:
        notionFilters.length > 1
          ? { and: notionFilters }
          : notionFilters[0] || undefined,
      sorts: [
        { property: 'Priority', direction: 'ascending' },
        { property: 'Due Date', direction: 'ascending' },
      ],
      page_size: 50,
    });

    // Format tasks
    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.Task?.title?.[0]?.plain_text || 'Untitled',
        priority: props.Priority?.select?.name || 'Someday',
        context: props.Context?.multi_select?.map((c: any) => c.name) || [],
        energy: props.Energy?.select?.name || 'Medium',
        time: props.Time?.select?.name || 'Short',
        dueDate: props['Due Date']?.date?.start || null,
        status: props.Status?.status?.name || 'Inbox',
        url: `https://notion.so/${page.id.replace(/-/g, '')}`,
      };
    });

    return NextResponse.json({
      focusMode,
      description: filter.description,
      tasks,
      count: tasks.length,
      availableFilters: FOCUS_MODE_FILTERS,
    });
  } catch (error) {
    console.error('Error fetching Focus Mode tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
