import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Store M365 events in a dedicated Notion page as JSON
const M365_CALENDAR_PAGE_ID = process.env.M365_CALENDAR_PAGE_ID;

interface M365Event {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  isAllDay: boolean;
  organizer?: string;
}

interface M365CalendarPayload {
  events: M365Event[];
  syncedAt: string;
  source: string;
}

// POST - Receive events from Power Automate
export async function POST(request: NextRequest) {
  try {
    // Simple auth - check for a secret header
    const authHeader = request.headers.get('x-tomos-secret');
    const expectedSecret = process.env.M365_SYNC_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Handle both single event and array of events
    let events: M365Event[] = [];

    if (Array.isArray(body.events)) {
      events = body.events;
    } else if (Array.isArray(body)) {
      // Power Automate might send array directly
      events = body.map((event: any) => ({
        id: event.id || event.Id,
        subject: event.subject || event.Subject || 'Untitled',
        start: event.start?.dateTime || event.Start || event.start,
        end: event.end?.dateTime || event.End || event.end,
        location: event.location?.displayName || event.Location || null,
        isAllDay: event.isAllDay || event.IsAllDay || false,
        organizer: event.organizer?.emailAddress?.name || event.Organizer || null,
      }));
    } else if (body.value) {
      // Power Automate Graph connector format
      events = body.value.map((event: any) => ({
        id: event.id,
        subject: event.subject || 'Untitled',
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        location: event.location?.displayName || null,
        isAllDay: event.isAllDay || false,
        organizer: event.organizer?.emailAddress?.name || null,
      }));
    }

    // Store in simple JSON format
    const payload: M365CalendarPayload = {
      events,
      syncedAt: new Date().toISOString(),
      source: 'power-automate',
    };

    // For now, store in environment variable as a workaround
    // In production, you'd want to use Vercel KV or a database
    // We'll use a simple file-based approach via Notion page

    if (M365_CALENDAR_PAGE_ID) {
      // Update Notion page with calendar data
      await notion.blocks.children.append({
        block_id: M365_CALENDAR_PAGE_ID,
        children: [
          {
            type: 'code',
            code: {
              language: 'json',
              rich_text: [{ type: 'text', text: { content: JSON.stringify(payload, null, 2) } }],
            },
          },
        ],
      });
    }

    // Also cache in global for immediate reads (ephemeral but useful)
    (global as any).__m365CalendarCache = payload;

    console.log(`M365 Calendar Sync: Received ${events.length} events`);

    return NextResponse.json({
      success: true,
      received: events.length,
      syncedAt: payload.syncedAt,
    });
  } catch (error) {
    console.error('M365 Calendar Sync Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET - Return cached events for iOS app
export async function GET(request: NextRequest) {
  try {
    // Check in-memory cache first
    const cached = (global as any).__m365CalendarCache as M365CalendarPayload | undefined;

    if (cached) {
      // Filter to only future events
      const now = new Date();
      const futureEvents = cached.events.filter(event => {
        const eventStart = new Date(event.start);
        return eventStart >= now;
      });

      return NextResponse.json({
        events: futureEvents,
        syncedAt: cached.syncedAt,
        source: cached.source,
        fromCache: true,
      });
    }

    // If no cache, return empty (Power Automate hasn't synced yet)
    return NextResponse.json({
      events: [],
      syncedAt: null,
      message: 'No events synced yet. Configure Power Automate to sync events.',
    });
  } catch (error) {
    console.error('M365 Calendar Get Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get events' },
      { status: 500 }
    );
  }
}
