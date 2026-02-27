import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Context-Aware Task Surfacing (Postgres)
 *
 * Intelligently surfaces the most relevant tasks based on
 * current time, day, priority, and due dates.
 * Returns AI-ranked list of "what to work on right now"
 */

export async function GET(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Current context in Sydney timezone
    const now = new Date();
    const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const hour = sydneyTime.getHours();
    const dayOfWeek = sydneyTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Australia/Sydney' });

    let timeContext = 'morning';
    if (hour >= 12 && hour < 17) timeContext = 'afternoon';
    else if (hour >= 17) timeContext = 'evening';

    // Fetch incomplete top-level tasks from Postgres
    const dbTasks = await prisma.task.findMany({
      where: { status: { not: 'done' }, parentId: null },
      include: { tags: { include: { tag: true } } },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 50,
    });

    const tasks = dbTasks.map((task, index) => ({
      index: index + 1,
      id: task.id,
      title: task.title,
      priority: task.priority || 'medium',
      tags: task.tags.map(t => t.tag.name).join(', ') || 'None',
      dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
      status: task.status,
    }));

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        context: { timeOfDay: timeContext, hour, dayOfWeek },
        recommendations: [],
        overallAdvice: "No incomplete tasks found.",
        totalTasksAnalyzed: 0,
      });
    }

    const prompt = `You are an expert productivity coach helping prioritize tasks for right now.

**Current Context:**
- Time: ${timeContext}, ${hour}:00 (${dayOfWeek})
- Total tasks: ${tasks.length}

**Available Tasks:**
${tasks.map((t) => `${t.index}. "${t.title}" - Priority: ${t.priority}, Tags: ${t.tags}, Due: ${t.dueDate || 'None'}`).join('\n')}

Recommend the top 5 tasks to work on RIGHT NOW. Consider time of day, priority, due dates, and context switching.

Return ONLY JSON:
{
  "recommendations": [
    {"index": 3, "reason": "Urgent and due today"},
    {"index": 7, "reason": "Quick win to build momentum"}
  ],
  "overallAdvice": "Brief tactical advice for this time slot"
}`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = aiResponse.content[0];
    if (aiContent.type !== 'text') throw new Error('Unexpected response type');

    let jsonText = aiContent.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    const aiRanking = JSON.parse(jsonText);

    const recommendedTasks = aiRanking.recommendations
      .filter((rec: any) => rec.index >= 1 && rec.index <= tasks.length)
      .map((rec: any) => ({ ...tasks[rec.index - 1], reason: rec.reason }));

    console.log(`Smart surface: ${recommendedTasks.length} tasks recommended for ${timeContext}`);

    return NextResponse.json({
      success: true,
      context: { timeOfDay: timeContext, hour, dayOfWeek },
      recommendations: recommendedTasks,
      overallAdvice: aiRanking.overallAdvice,
      totalTasksAnalyzed: tasks.length,
    });
  } catch (error) {
    console.error('Error surfacing tasks:', error);
    return NextResponse.json(
      { error: 'Failed to surface tasks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
