import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters/[id]/notes
 * List all notes for a matter
 * Query params: type, limit, offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
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

    const [notes, total] = await Promise.all([
      prisma.matterNote.findMany({
        where,
        orderBy: [
          { updatedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.matterNote.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: notes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notes.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matters/[id]/notes
 * Create a new note for a matter
 * Body: { title, content, type, author, tags }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Required fields
    if (!body.content) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: content' },
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

    // Create note
    const note = await prisma.matterNote.create({
      data: {
        matterId: params.id,
        title: body.title || null,
        content: body.content,
        type: body.type || 'general',
        author: body.author || null,
        tags: body.tags || [],
      },
    });

    // Update matter's lastActivityAt
    await prisma.matter.update({
      where: { id: params.id },
      data: { lastActivityAt: new Date() },
    }).catch(err => console.error('Error updating matter activity:', err));

    // Create event
    await prisma.matterEvent.create({
      data: {
        matterId: params.id,
        type: 'note_added',
        title: 'Note added',
        description: body.title
          ? `Note "${body.title}" (${body.type}) added`
          : `New ${body.type} note added`,
        actor: body.author || 'System',
      },
    }).catch(err => console.error('Error creating note event:', err));

    return NextResponse.json({
      success: true,
      data: note,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
