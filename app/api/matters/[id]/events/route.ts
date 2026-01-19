import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters/[id]/events
 * List all events for a matter (activity timeline)
 * Query params: type, limit, offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if matter exists
    const matter = await prisma.matter.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!matter) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    const where: any = { matterId: params.id };
    if (type) where.type = type;

    const [events, total] = await Promise.all([
      prisma.matterEvent.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.matterEvent.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matters/[id]/events
 * Create a custom event (for manual timeline entries)
 * Body: { type, title, description, actor, metadata }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Required fields
    if (!body.type || !body.title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, title' },
        { status: 400 }
      );
    }

    // Check if matter exists
    const matter = await prisma.matter.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!matter) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Create event
    const event = await prisma.matterEvent.create({
      data: {
        matterId: params.id,
        type: body.type,
        title: body.title,
        description: body.description || null,
        actor: body.actor || 'System',
        metadata: body.metadata || null,
      },
    });

    // Update matter's lastActivityAt
    await prisma.matter.update({
      where: { id: params.id },
      data: { lastActivityAt: new Date() },
    }).catch(err => console.error('Error updating matter activity:', err));

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
