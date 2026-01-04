import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import Anthropic from '@anthropic-ai/sdk';

const NOTION_DATABASE_ID = '739144099ebc4ba1ba619dd1a5a08d25';

/**
 * Morning Overview Notification
 * Sends intelligent daily overview at 8am with:
 * - Today's tasks (by priority)
 * - Smart suggestions from Claude
 * - Focus Mode recommendation
 * - Link to dashboard
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.NOTION_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Missing API keys' },
        { status: 500 }
      );
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get today's date in Sydney timezone
    const now = new Date();
    const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const today = sydneyTime.toISOString().split('T')[0];

    // Fetch today's tasks
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            or: [
              {
                property: 'Status',
                select: { equals: 'Inbox' },
              },
              {
                property: 'Status',
                select: { equals: 'In Progress' },
              },
              {
                property: 'Status',
                select: { equals: 'Blocked' },
              },
            ],
          },
        ],
      },
      sorts: [
        { property: 'Priority', direction: 'ascending' },
        { property: 'Due Date', direction: 'ascending' },
      ],
      page_size: 50,
    });

    // Format tasks
    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      return {
        title: props.Task?.title?.[0]?.plain_text || 'Untitled',
        priority: props.Priority?.select?.name || 'Someday',
        context: props.Context?.multi_select?.map((c: any) => c.name).join(', ') || 'None',
        energy: props.Energy?.select?.name || 'Medium',
        time: props.Time?.select?.name || 'Short',
        dueDate: props['Due Date']?.date?.start || null,
        status: props.Status?.select?.name || 'Inbox',
      };
    });

    // Separate by priority
    const urgent = tasks.filter((t) => t.priority === 'Urgent');
    const important = tasks.filter((t) => t.priority === 'Important');
    const someday = tasks.filter((t) => t.priority === 'Someday');
    const dueToday = tasks.filter((t) => t.dueDate?.startsWith(today));

    // Get AI suggestions
    const taskSummary = `
You have ${tasks.length} active tasks:
- ${urgent.length} Urgent
- ${important.length} Important
- ${someday.length} Someday
- ${dueToday.length} due today

Urgent tasks:
${urgent.slice(0, 5).map((t) => `- ${t.title} (${t.time}, ${t.energy} energy)`).join('\n')}

Important tasks:
${important.slice(0, 5).map((t) => `- ${t.title} (${t.time}, ${t.energy} energy)`).join('\n')}
`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are a productivity coach. Based on this morning's task list, provide:
1. A brief motivational message (1 sentence)
2. Top 3 priorities for today (be specific, use actual task titles)
3. Suggested Focus Mode (Work/Personal/Deep Work)
4. One tactical tip for the day

Keep it concise and actionable. Format as plain text, no markdown.

${taskSummary}`,
        },
      ],
    });

    const aiSuggestion =
      aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

    // Build notification
    const dashboardUrl = 'https://tomos-task-api.vercel.app';

    const notificationBody = `☀️ Good morning! You have ${tasks.length} active tasks.

📊 Breakdown:
🔴 ${urgent.length} Urgent
🟠 ${important.length} Important
⚪ ${someday.length} Someday
📅 ${dueToday.length} due today

🤖 AI Suggestion:
${aiSuggestion}

👉 View Dashboard`;

    // Send APNs push notification to iOS/macOS devices
    // Always use the production URL for internal API calls to avoid VERCEL_URL issues
    // (VERCEL_URL points to deployment-specific URLs that may not have all env vars)
    const pushResponse = await fetch('https://tomos-task-api.vercel.app/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Morning Overview',
        body: notificationBody,
        priority: urgent.length > 0 ? 'urgent' : 'normal',
        badge: tasks.length,
      }),
    });

    const pushResult = await pushResponse.json();
    console.log('Morning overview sent via APNs:', pushResult);

    return NextResponse.json({
      success: true,
      timestamp: sydneyTime.toISOString(),
      taskCount: tasks.length,
      urgent: urgent.length,
      important: important.length,
      dueToday: dueToday.length,
    });
  } catch (error) {
    console.error('Error sending morning overview:', error);
    return NextResponse.json(
      {
        error: 'Failed to send morning overview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
