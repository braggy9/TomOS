import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

// Google Calendar configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://tomos-task-api.vercel.app/api/calendar/callback';

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string | null;
  context: string | null;
  tags: string[];
  description?: string;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    const { action, refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Google Calendar refresh token required' },
        { status: 400 }
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    if (action === 'sync') {
      return await syncTasksToCalendar(calendar, refreshToken);
    }

    if (action === 'syncOne') {
      const { taskId } = await request.json();
      return await syncSingleTask(calendar, taskId);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in calendar sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync calendar' },
      { status: 500 }
    );
  }
}

async function syncTasksToCalendar(calendar: any, refreshToken: string) {
  try {
    // Get all tasks from Notion with due dates
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Due Date',
            date: {
              is_not_empty: true,
            },
          },
          {
            property: 'Status',
            status: {
              does_not_equal: 'Done',
            },
          },
        ],
      },
    });

    const tasks: Task[] = response.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Task?.title?.[0]?.plain_text || 'Untitled Task',
      dueDate: page.properties['Due Date']?.date?.start || null,
      priority: page.properties.Priority?.select?.name || null,
      context: page.properties.Context?.select?.name || null,
      tags: page.properties.Tags?.multi_select?.map((t: any) => t.name) || [],
      status: page.properties.Status?.status?.name || 'To Do',
      description: page.properties.Description?.rich_text?.[0]?.plain_text || '',
    }));

    // Get existing TomOS events from calendar
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    const existingEvents = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      q: '[TomOS]', // Search for events with [TomOS] tag
      singleEvents: true,
    });

    const existingEventMap = new Map(
      existingEvents.data.items?.map((event: any) => [
        event.extendedProperties?.private?.taskId,
        event,
      ]) || []
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const task of tasks) {
      if (!task.dueDate) {
        skipped++;
        continue;
      }

      const existingEvent = existingEventMap.get(task.id) as any;

      const eventData = createEventFromTask(task);

      if (existingEvent?.id) {
        // Update existing event
        await calendar.events.update({
          calendarId: 'primary',
          eventId: existingEvent.id,
          requestBody: eventData,
        });
        updated++;
      } else {
        // Create new event
        await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventData,
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: {
        created,
        updated,
        skipped,
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error('Error syncing tasks:', error);
    throw error;
  }
}

async function syncSingleTask(calendar: any, taskId: string) {
  try {
    // Get specific task from Notion
    const page = await notion.pages.retrieve({ page_id: taskId });

    const task: Task = {
      id: page.id,
      title: (page as any).properties.Task?.title?.[0]?.plain_text || 'Untitled Task',
      dueDate: (page as any).properties['Due Date']?.date?.start || null,
      priority: (page as any).properties.Priority?.select?.name || null,
      context: (page as any).properties.Context?.select?.name || null,
      tags: (page as any).properties.Tags?.multi_select?.map((t: any) => t.name) || [],
      status: (page as any).properties.Status?.status?.name || 'To Do',
      description: (page as any).properties.Description?.rich_text?.[0]?.plain_text || '',
    };

    if (!task.dueDate) {
      return NextResponse.json({
        success: false,
        error: 'Task has no due date',
      });
    }

    // Check if event already exists
    const existingEvents = await calendar.events.list({
      calendarId: 'primary',
      privateExtendedProperty: `taskId=${taskId}`,
      singleEvents: true,
    });

    const eventData = createEventFromTask(task);

    if (existingEvents.data.items && existingEvents.data.items.length > 0) {
      // Update existing event
      const existingEvent = existingEvents.data.items[0];
      await calendar.events.update({
        calendarId: 'primary',
        eventId: existingEvent.id,
        requestBody: eventData,
      });

      return NextResponse.json({
        success: true,
        action: 'updated',
        eventId: existingEvent.id,
      });
    } else {
      // Create new event
      const newEvent = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventData,
      });

      return NextResponse.json({
        success: true,
        action: 'created',
        eventId: newEvent.data.id,
      });
    }
  } catch (error) {
    console.error('Error syncing single task:', error);
    throw error;
  }
}

function createEventFromTask(task: Task): any {
  const dueDate = new Date(task.dueDate!);
  const hasTime = task.dueDate!.includes('T');

  // Create description with task metadata
  let description = `[TomOS] ${task.title}\n\n`;
  if (task.description) {
    description += `${task.description}\n\n`;
  }
  if (task.priority) {
    description += `Priority: ${task.priority}\n`;
  }
  if (task.context) {
    description += `Context: ${task.context}\n`;
  }
  if (task.tags.length > 0) {
    description += `Tags: ${task.tags.join(', ')}\n`;
  }
  description += `\nView in Notion: https://notion.so/${task.id.replace(/-/g, '')}`;

  // Priority-based colors
  const colorMap: { [key: string]: string } = {
    'Urgent': '11', // Red
    'Important': '5', // Yellow
    'Someday': '2', // Green
  };

  const event: any = {
    summary: `[TomOS] ${task.title}`,
    description,
    colorId: task.priority ? colorMap[task.priority] : '7', // Default: light blue
    extendedProperties: {
      private: {
        taskId: task.id,
        priority: task.priority || '',
        context: task.context || '',
        tags: task.tags.join(','),
        source: 'tomos',
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
      ],
    },
  };

  if (hasTime) {
    // Event with specific time
    const endDate = new Date(dueDate);
    endDate.setHours(endDate.getHours() + 1); // 1-hour duration by default

    event.start = {
      dateTime: dueDate.toISOString(),
      timeZone: 'Australia/Sydney',
    };
    event.end = {
      dateTime: endDate.toISOString(),
      timeZone: 'Australia/Sydney',
    };
  } else {
    // All-day event
    event.start = {
      date: dueDate.toISOString().split('T')[0],
    };
    event.end = {
      date: dueDate.toISOString().split('T')[0],
    };
  }

  return event;
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refreshToken = searchParams.get('refreshToken');

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token required' },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Count TomOS events in calendar
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      q: '[TomOS]',
      singleEvents: true,
    });

    // Count tasks in Notion with due dates
    const notionTasks = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Due Date',
            date: {
              is_not_empty: true,
            },
          },
          {
            property: 'Status',
            status: {
              does_not_equal: 'Done',
            },
          },
        ],
      },
    });

    return NextResponse.json({
      calendarEvents: events.data.items?.length || 0,
      notionTasks: notionTasks.results.length,
      inSync: events.data.items?.length === notionTasks.results.length,
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check sync status' },
      { status: 500 }
    );
  }
}
