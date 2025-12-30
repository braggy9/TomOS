import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import Anthropic from '@anthropic-ai/sdk';

const NOTION_DATABASE_ID = '739144099ebc4ba1ba619dd1a5a08d25';

/**
 * Context-Aware Task Surfacing
 *
 * Intelligently surfaces the most relevant tasks based on:
 * - Current time of day
 * - Day of week
 * - Active Focus Mode
 * - Upcoming calendar events (if integrated)
 * - Your energy patterns
 * - Task dependencies
 *
 * Returns AI-ranked list of "what to work on right now"
 */

async function getCurrentFocusMode(): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tomos-task-api.vercel.app';

    const response = await fetch(`${baseUrl}/api/focus/state`);
    if (!response.ok) return 'None';

    const data = await response.json();
    return data.focusMode || 'None';
  } catch (error) {
    console.error('Error fetching Focus Mode:', error);
    return 'None';
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NOTION_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Missing API keys' },
        { status: 500 }
      );
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get current context
    const now = new Date();
    const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const hour = sydneyTime.getHours();
    const dayOfWeek = sydneyTime.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'Australia/Sydney',
    });
    const focusMode = await getCurrentFocusMode();

    // Determine time context
    let timeContext = 'morning';
    if (hour >= 12 && hour < 17) timeContext = 'afternoon';
    else if (hour >= 17) timeContext = 'evening';

    // Fetch all incomplete tasks
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Status',
        select: {
          does_not_equal: 'Done',
        },
      },
      sorts: [
        { property: 'Priority', direction: 'ascending' },
        { property: 'Due Date', direction: 'ascending' },
      ],
      page_size: 50,
    });

    // Format tasks for AI
    const tasks = response.results.map((page: any, index: number) => {
      const props = page.properties;
      return {
        index: index + 1,
        id: page.id,
        title: props.Task?.title?.[0]?.plain_text || 'Untitled',
        priority: props.Priority?.select?.name || 'Someday',
        context: props.Context?.multi_select?.map((c: any) => c.name).join(', ') || 'None',
        energy: props.Energy?.select?.name || 'Medium',
        time: props.Time?.select?.name || 'Short',
        dueDate: props['Due Date']?.date?.start || null,
        status: props.Status?.select?.name || 'Inbox',
      };
    });

    // Ask Claude to intelligently rank tasks
    const prompt = `You are an expert productivity coach helping prioritize tasks for right now.

**Current Context:**
- Time: ${timeContext}, ${hour}:00 (${dayOfWeek})
- Focus Mode: ${focusMode}
- Total tasks: ${tasks.length}

**Available Tasks:**
${tasks.map((t) => `${t.index}. "${t.title}" - Priority: ${t.priority}, Context: ${t.context}, Energy: ${t.energy}, Time: ${t.time}, Due: ${t.dueDate || 'None'}`).join('\n')}

**Instructions:**
Analyze the current context and recommend the top 5 tasks to work on RIGHT NOW.

Consider:
1. **Time of day**: Morning = high-energy tasks, afternoon = focused work, evening = admin/planning
2. **Focus Mode**: Only recommend tasks matching the active focus (if set)
3. **Priority**: Urgent > Important > Someday
4. **Due dates**: Prioritize tasks due today/soon
5. **Energy match**: Match task energy to typical energy patterns for this time
6. **Time fit**: Quick wins if it's late, longer tasks if it's early
7. **Context switching**: Minimize context switches in your recommendations

Return ONLY a JSON array of task indices (1-${tasks.length}) in priority order, with brief reasoning:

{
  "recommendations": [
    {"index": 3, "reason": "Urgent and due today, matches Work focus"},
    {"index": 7, "reason": "Quick win to build momentum"},
    ...
  ],
  "overallAdvice": "Brief tactical advice for this time slot"
}`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = aiResponse.content[0];
    if (aiContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse Claude's response
    let jsonText = aiContent.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    const aiRanking = JSON.parse(jsonText);

    // Map indices back to full task objects
    const recommendedTasks = aiRanking.recommendations.map((rec: any) => {
      const task = tasks[rec.index - 1];
      return {
        ...task,
        reason: rec.reason,
        url: `https://notion.so/${task.id.replace(/-/g, '')}`,
      };
    });

    console.log(`Context-aware surfacing: ${recommendedTasks.length} tasks recommended for ${timeContext} ${focusMode} mode`);

    return NextResponse.json({
      success: true,
      context: {
        timeOfDay: timeContext,
        hour,
        dayOfWeek,
        focusMode,
      },
      recommendations: recommendedTasks,
      overallAdvice: aiRanking.overallAdvice,
      totalTasksAnalyzed: tasks.length,
    });
  } catch (error) {
    console.error('Error surfacing tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to surface tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
