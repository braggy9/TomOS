import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/journal/search?q=query&tags=tag1,tag2&limit=20&offset=0
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const mood = searchParams.get('mood');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    // Build conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Full-text search condition
    conditions.push(
      `to_tsvector('english', coalesce("title", '') || ' ' || "content") @@ plainto_tsquery('english', $${paramIndex})`
    );
    params.push(query.trim());
    paramIndex++;

    // Tag filter
    if (tags && tags.length > 0) {
      conditions.push(`"tags" && $${paramIndex}::text[]`);
      params.push(tags);
      paramIndex++;
    }

    // Mood filter
    if (mood) {
      conditions.push(`"mood" = $${paramIndex}`);
      params.push(mood);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Search with relevance ranking
    const entries = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, title, content, excerpt, "wordCount", mood, energy, reflection, themes, tags, "entryDate", "createdAt", "updatedAt",
        ts_rank(to_tsvector('english', coalesce("title", '') || ' ' || "content"), plainto_tsquery('english', $1)) as relevance
       FROM journal_entries
       WHERE ${whereClause}
       ORDER BY relevance DESC, "entryDate" DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...params,
      limit,
      offset
    );

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM journal_entries WHERE ${whereClause}`,
      ...params
    );
    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total,
      },
    });
  } catch (error) {
    console.error('Error searching journal entries:', error);
    return NextResponse.json(
      { error: 'Failed to search journal entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
