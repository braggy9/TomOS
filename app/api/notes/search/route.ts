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
    // Build WHERE clause
    const tagFilter = tags && tags.length > 0
      ? `AND tags && ARRAY[${tags.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}]::text[]`
      : '';

    // First, get note IDs that match the search using raw SQL
    const searchQuery = `
      SELECT id, ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', $1)) as rank
      FROM notes
      WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $1)
      ${tagFilter}
      ORDER BY rank DESC, "updatedAt" DESC
      LIMIT $2 OFFSET $3
    `;

    const searchResults = await prisma.$queryRawUnsafe<Array<{ id: string; rank: number }>>(
      searchQuery,
      query,
      limit,
      offset
    );

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
    const countQuery = `
      SELECT COUNT(*)::int as count
      FROM notes
      WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $1)
      ${tagFilter}
    `;

    const [{ count: total }] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      countQuery,
      query
    );


    return NextResponse.json({
      success: true,
      data: {
        notes,
        query,
        total,
        limit,
        offset,
        hasMore: offset + notes.length < Number(total)
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
