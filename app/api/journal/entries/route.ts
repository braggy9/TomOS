import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/journal/entries - List journal entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    const mood = searchParams.get('mood');
    const from = searchParams.get('from'); // ISO date string
    const to = searchParams.get('to');     // ISO date string

    const where: any = {};

    if (mood) {
      where.mood = mood;
    }
    if (from || to) {
      where.entryDate = {};
      if (from) where.entryDate.gte = new Date(from);
      if (to) where.entryDate.lte = new Date(to);
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { entryDate: 'desc' },
        include: {
          conversations: {
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.journalEntry.count({ where }),
    ]);

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
    console.error('Error fetching journal entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/journal/entries - Create journal entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const content = body.content.trim();
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const title = body.title || content.split('\n')[0].substring(0, 100);
    const excerpt = content.substring(0, 200).replace(/[#*`_\[\]]/g, '').trim();

    const entry = await prisma.journalEntry.create({
      data: {
        content,
        title,
        excerpt,
        wordCount,
        mood: body.mood || null,
        energy: body.energy || null,
        themes: body.themes || [],
        tags: body.tags || [],
        entryDate: body.entryDate ? new Date(body.entryDate) : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: entry,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to create journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
