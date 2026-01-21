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

    // Use PostgreSQL full-text search for better performance and ranking
    // First, get note IDs that match the search using raw SQL
    const searchResults = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT id, ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', ${query})) as rank
      FROM notes
      WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${query})
      ${tags && tags.length > 0 ? prisma.$queryRaw`AND tags && ARRAY[${tags.join(',')}]::text[]` : prisma.$queryRaw``}
      ORDER BY rank DESC, "updatedAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const noteIds = searchResults.map(r => r.id);

    // Get full note data for matched IDs (preserving rank order)
    const notesMap = new Map();
    if (noteIds.length > 0) {
      const fullNotes = await prisma.note.findMany({
        where: { id: { in: noteIds } },
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

      fullNotes.forEach(note => notesMap.set(note.id, note));
    }

    // Preserve rank order
    const notes = noteIds.map(id => notesMap.get(id)).filter(Boolean);

    // Get total count
    const [{ count: total }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int as count
      FROM notes
      WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${query})
      ${tags && tags.length > 0 ? prisma.$queryRaw`AND tags && ARRAY[${tags.join(',')}]::text[]` : prisma.$queryRaw``}
    `;


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
