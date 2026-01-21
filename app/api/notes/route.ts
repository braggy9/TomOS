import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { processSmartLinks } from '@/lib/smartLinking';

const prisma = new PrismaClient();

// GET /api/notes - List notes with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const pinned = searchParams.get('pinned');
    const taskId = searchParams.get('taskId');
    const matterId = searchParams.get('matterId');
    const projectId = searchParams.get('projectId');
    const tags = searchParams.get('tags')?.split(',').filter(t => t);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {};

    if (pinned !== null) {
      where.isPinned = pinned === 'true';
    }
    if (taskId) {
      where.taskId = taskId;
    }
    if (matterId) {
      where.matterId = matterId;
    }
    if (projectId) {
      where.projectId = projectId;
    }
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Fetch notes
    const notes = await prisma.note.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [sortBy]: sortOrder },
      include: {
        task: {
          select: { id: true, title: true, status: true }
        },
        matter: {
          select: { id: true, title: true, client: true }
        },
        project: {
          select: { id: true, title: true, color: true }
        }
      }
    });

    // Get total count
    const total = await prisma.note.count({ where });

    return NextResponse.json({
      success: true,
      data: notes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notes.length < total
      }
    });

  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create new note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Generate excerpt if not provided (first 200 chars of content)
    const excerpt = body.excerpt || body.content.substring(0, 200).replace(/[#*`_\[\]]/g, '').trim();

    // Process smart links in content
    const { resolvedLinks } = await processSmartLinks(body.content);

    // Create note
    const note = await prisma.note.create({
      data: {
        title: body.title,
        content: body.content,
        excerpt,
        tags: body.tags || [],
        isPinned: body.isPinned || false,
        priority: body.priority || 'medium',
        status: body.status || 'active',
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
        confidential: body.confidential || false,
        links: resolvedLinks as any, // Store resolved links
        taskId: body.taskId || null,
        matterId: body.matterId || null,
        projectId: body.projectId || null
      },
      include: {
        task: {
          select: { id: true, title: true }
        },
        matter: {
          select: { id: true, title: true, client: true }
        },
        project: {
          select: { id: true, title: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: note
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
