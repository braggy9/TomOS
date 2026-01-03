import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
// Use existing parent page or device tokens DB parent
const NOTION_PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID || '26f46505452d8001a172c824053753e9';

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

// Helper to find or create the M365 Calendar storage page
async function getOrCreateStoragePage(): Promise<string> {
  // Search for existing page
  const searchResponse = await notion.search({
    query: 'TomOS M365 Calendar Data',
    filter: { property: 'object', value: 'page' },
  });

  const existingPage = searchResponse.results.find(
    (page: any) => page.properties?.title?.title?.[0]?.plain_text === 'TomOS M365 Calendar Data'
  );

  if (existingPage) {
    return existingPage.id;
  }

  // Create new page
  const newPage = await notion.pages.create({
    parent: { page_id: NOTION_PARENT_PAGE_ID! },
    properties: {
      title: {
        title: [{ text: { content: 'TomOS M365 Calendar Data' } }],
      },
    },
  });

  return newPage.id;
}

// POST - Receive events from Power Automate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle various Power Automate formats
    let events: M365Event[] = [];

    if (Array.isArray(body.events)) {
      events = body.events;
    } else if (Array.isArray(body)) {
      events = body.map((event: any) => ({
        id: event.id || event.Id || String(Date.now()),
        subject: event.subject || event.Subject || 'Untitled',
        start: event.start?.dateTime || event.Start || event.start || '',
        end: event.end?.dateTime || event.End || event.end || '',
        location: event.location?.displayName || event.Location || null,
        isAllDay: event.isAllDay || event.IsAllDay || false,
        organizer: event.organizer?.emailAddress?.name || event.Organizer || null,
      }));
    } else if (body.value) {
      // Power Automate Graph connector format
      events = body.value.map((event: any) => ({
        id: event.id,
        subject: event.subject || 'Untitled',
        start: event.start?.dateTime || '',
        end: event.end?.dateTime || '',
        location: event.location?.displayName || null,
        isAllDay: event.isAllDay || false,
        organizer: event.organizer?.emailAddress?.name || null,
      }));
    }

    const payload: M365CalendarPayload = {
      events,
      syncedAt: new Date().toISOString(),
      source: 'power-automate',
    };

    // Store in Notion page
    const pageId = await getOrCreateStoragePage();

    // Clear existing content and add new
    const existingBlocks = await notion.blocks.children.list({ block_id: pageId });
    for (const block of existingBlocks.results) {
      await notion.blocks.delete({ block_id: block.id });
    }

    // Add new content as code block
    await notion.blocks.children.append({
      block_id: pageId,
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

    console.log(`M365 Calendar Sync: Stored ${events.length} events in Notion`);

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

// GET - Return stored events for iOS app
export async function GET(request: NextRequest) {
  try {
    const pageId = await getOrCreateStoragePage();

    // Get the code block content
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    const codeBlock = blocks.results.find((block: any) => block.type === 'code') as any;

    if (codeBlock?.code?.rich_text?.[0]?.plain_text) {
      const payload: M365CalendarPayload = JSON.parse(codeBlock.code.rich_text[0].plain_text);

      // Filter to only future events
      const now = new Date();
      const futureEvents = payload.events.filter(event => {
        const eventStart = new Date(event.start);
        return eventStart >= now;
      });

      return NextResponse.json({
        events: futureEvents,
        syncedAt: payload.syncedAt,
        source: payload.source,
      });
    }

    return NextResponse.json({
      events: [],
      syncedAt: null,
      message: 'No events synced yet. Run your Power Automate flow.',
    });
  } catch (error) {
    console.error('M365 Calendar Get Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get events' },
      { status: 500 }
    );
  }
}
