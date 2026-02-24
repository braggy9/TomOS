import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const prisma = new PrismaClient();

// Fire-and-forget: extract themes from content using Claude
async function extractThemes(entryId: string, content: string) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-3-20240307',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Extract 2-5 key themes from this journal entry. Return ONLY a JSON array of lowercase single-word or two-word theme strings. No explanation.

Examples: ["work", "kids", "exercise", "anxiety", "sleep", "running", "legal work"]

Entry:
${content.substring(0, 1000)}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const themes = JSON.parse(text.trim());

    if (Array.isArray(themes) && themes.length > 0) {
      await prisma.journalEntry.update({
        where: { id: entryId },
        data: { themes },
      });
    }
  } catch (err) {
    console.error('Background theme extraction error:', err);
  }
}

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

    // Fire-and-forget: extract themes in background (don't block response)
    if (!body.themes || body.themes.length === 0) {
      extractThemes(entry.id, content).catch(err =>
        console.error('Theme extraction failed:', err)
      );
    }

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
