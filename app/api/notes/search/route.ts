import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/notes/search - Search notes by title and content
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const tags = searchParams.get('tags')?.split(',').filter(t => t);

    if (!query) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    // Build where clause for search
    const where: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } }
      ]
    };

    // Add tag filter if provided
    if (tags && tags.length > 0) {
      where.AND = { tags: { hasSome: tags } };
    }

    // Search notes
    const notes = await prisma.note.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' }
      ],
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
      query,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notes.length < total
      }
    });

  } catch (error) {
    console.error('Error searching notes:', error);
    return NextResponse.json(
      { error: 'Failed to search notes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
