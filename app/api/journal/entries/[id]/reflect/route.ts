import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { REFLECTION_PROMPT, buildDynamicContext } from '@/lib/journalPrompt';

const prisma = new PrismaClient();

// POST /api/journal/entries/[id]/reflect - Generate AI reflection for an entry
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      );
    }

    // Get recent entries for context (last 7 days, excluding current)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentEntries = await prisma.journalEntry.findMany({
      where: {
        id: { not: id },
        entryDate: { gte: weekAgo },
      },
      orderBy: { entryDate: 'desc' },
      take: 5,
      select: {
        entryDate: true,
        mood: true,
        content: true,
        reflection: true,
        themes: true,
      },
    });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const dynamicContext = buildDynamicContext(
      recentEntries.map(e => ({
        entryDate: e.entryDate.toISOString().split('T')[0],
        mood: e.mood,
        content: e.content,
        reflection: e.reflection,
      }))
    );

    const weeklyThemes = recentEntries.flatMap(e => e.themes);
    const themeCounts = weeklyThemes.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 300,
      system: REFLECTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `## Entry
${entry.content}

## Recent Context
${dynamicContext || 'No recent entries.'}

## Recurring Themes This Week
${Object.entries(themeCounts).map(([t, c]) => `- ${t}: ${c} times`).join('\n') || 'None yet.'}`,
        },
      ],
    });

    const reflection = message.content[0].type === 'text' ? message.content[0].text : '';

    // Save reflection to entry
    const updated = await prisma.journalEntry.update({
      where: { id },
      data: { reflection },
    });

    return NextResponse.json({
      success: true,
      data: {
        reflection,
        entry: updated,
      },
    });
  } catch (error) {
    console.error('Error generating reflection:', error);
    return NextResponse.json(
      { error: 'Failed to generate reflection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
