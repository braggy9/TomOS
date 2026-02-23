import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { WEEKLY_SUMMARY_PROMPT } from '@/lib/journalPrompt';

const prisma = new PrismaClient();

// POST /api/journal/summary - Generate a weekly or monthly summary
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type || 'weekly'; // weekly or monthly

    const now = new Date();
    let periodStart: Date;
    let periodEnd = now;

    if (type === 'weekly') {
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 7);
    } else {
      periodStart = new Date(now);
      periodStart.setMonth(periodStart.getMonth() - 1);
    }

    // Get entries in period
    const entries = await prisma.journalEntry.findMany({
      where: {
        entryDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: { entryDate: 'asc' },
    });

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No journal entries found in this period' },
        { status: 404 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const entriesText = entries.map(e => `
**${e.entryDate.toISOString().split('T')[0]}** (${e.mood || 'no mood'})
${e.content}
`).join('\n---\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 800,
      system: WEEKLY_SUMMARY_PROMPT,
      messages: [
        {
          role: 'user',
          content: `## This ${type === 'weekly' ? "Week's" : "Month's"} Entries\n${entriesText}`,
        },
      ],
    });

    const summaryContent = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract themes from entries
    const allThemes = entries.flatMap(e => e.themes);
    const themeCounts: Record<string, number> = {};
    allThemes.forEach(t => {
      themeCounts[t] = (themeCounts[t] || 0) + 1;
    });
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);

    // Mood pattern
    const moods = entries.filter(e => e.mood).map(e => e.mood);
    const moodPattern = moods.length > 0
      ? `Mood logged ${moods.length}/${entries.length} entries. Most common: ${mode(moods)}`
      : 'No moods logged this period.';

    // Save summary
    const summary = await prisma.journalSummary.create({
      data: {
        type,
        periodStart,
        periodEnd,
        content: summaryContent,
        themes: topThemes,
        moodPattern,
        insights: {
          entryCount: entries.length,
          totalWords: entries.reduce((sum, e) => sum + e.wordCount, 0),
          moodDistribution: moods.reduce((acc, m) => {
            if (m) acc[m] = (acc[m] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error generating journal summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/journal/summary - List existing summaries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // weekly or monthly

    const where: any = {};
    if (type) where.type = type;

    const summaries = await prisma.journalSummary.findMany({
      where,
      orderBy: { periodEnd: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: summaries,
    });
  } catch (error) {
    console.error('Error fetching journal summaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summaries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Utility: find most common value in array
function mode(arr: (string | null)[]): string {
  const counts: Record<string, number> = {};
  arr.forEach(v => {
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
}
