import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/journal/insights - Get journal statistics and patterns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get entries in period
    const entries = await prisma.journalEntry.findMany({
      where: { entryDate: { gte: since } },
      orderBy: { entryDate: 'desc' },
      select: {
        id: true,
        entryDate: true,
        mood: true,
        energy: true,
        themes: true,
        wordCount: true,
        createdAt: true,
      },
    });

    // Total entry count
    const totalEntries = await prisma.journalEntry.count();

    // Mood distribution
    const moodCounts: Record<string, number> = {};
    entries.forEach(e => {
      if (e.mood) {
        moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
      }
    });

    // Energy distribution
    const energyCounts: Record<string, number> = {};
    entries.forEach(e => {
      if (e.energy) {
        energyCounts[e.energy] = (energyCounts[e.energy] || 0) + 1;
      }
    });

    // Theme frequency
    const themeCounts: Record<string, number> = {};
    entries.forEach(e => {
      e.themes.forEach(t => {
        themeCounts[t] = (themeCounts[t] || 0) + 1;
      });
    });
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([theme, count]) => ({ theme, count }));

    // Word count stats
    const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);
    const avgWords = entries.length > 0 ? Math.round(totalWords / entries.length) : 0;

    // Streak calculation
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDates = new Set(
      entries.map(e => e.entryDate.toISOString().split('T')[0])
    );

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (entryDates.has(dateStr)) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Entries per week (for the period)
    const weeks = Math.ceil(days / 7);
    const entriesPerWeek = entries.length > 0 ? (entries.length / weeks).toFixed(1) : '0';

    // Recent conversations count
    const conversationCount = await prisma.journalConversation.count({
      where: { createdAt: { gte: since } },
    });

    return NextResponse.json({
      success: true,
      data: {
        period: { days, from: since.toISOString(), to: new Date().toISOString() },
        stats: {
          totalEntries,
          periodEntries: entries.length,
          currentStreak,
          entriesPerWeek: parseFloat(entriesPerWeek),
          totalWords,
          avgWordsPerEntry: avgWords,
          conversationsThisPeriod: conversationCount,
        },
        moods: moodCounts,
        energy: energyCounts,
        topThemes,
        // Mood timeline (last N entries for charting)
        moodTimeline: entries
          .filter(e => e.mood)
          .map(e => ({
            date: e.entryDate.toISOString().split('T')[0],
            mood: e.mood,
            energy: e.energy,
          }))
          .reverse(),
      },
    });
  } catch (error) {
    console.error('Error fetching journal insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
