import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import Anthropic from '@anthropic-ai/sdk';

const NOTION_DATABASE_ID = '739144099ebc4ba1ba619dd1a5a08d25';

/**
 * End-of-Day Summary Notification
 * Sends intelligent daily summary at 6pm with:
 * - Tasks completed today
 * - Remaining tasks
 * - Tomorrow's preview
 * - AI reflection & advice
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

    // Calculate tomorrow
    const tomorrow = new Date(sydneyTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // Fetch tasks completed today
    const completedToday = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Status',
            select: { equals: 'Done' },
          },
          {
            property: 'Captured',
            date: { on_or_after: today },
          },
        ],
      },
      page_size: 50,
    });

    // Fetch remaining incomplete tasks
    const remaining = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Status',
            select: { does_not_equal: 'Done' },
          },
        ],
      },
      sorts: [{ property: 'Priority', direction: 'ascending' }],
      page_size: 20,
    });

    // Fetch tomorrow's tasks
    const tomorrowTasks = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        and: [
          {
            property: 'Due Date',
            date: { equals: tomorrowDate },
          },
          {
            property: 'Status',
            select: { does_not_equal: 'Done' },
          },
        ],
      },
      page_size: 10,
    });

    // Format counts
    const completedCount = completedToday.results.length;
    const remainingCount = remaining.results.length;
    const tomorrowCount = tomorrowTasks.results.length;

    // Get completed task titles
    const completedTitles = completedToday.results
      .slice(0, 5)
      .map((page: any) => page.properties.Task?.title?.[0]?.plain_text || 'Untitled');

    // Get remaining urgent tasks
    const remainingUrgent = remaining.results
      .filter(
        (page: any) => page.properties.Priority?.select?.name === 'Urgent'
      )
      .slice(0, 3)
      .map((page: any) => page.properties.Task?.title?.[0]?.plain_text || 'Untitled');

    // Get tomorrow's top tasks
    const tomorrowTop = tomorrowTasks.results
      .slice(0, 3)
      .map((page: any) => page.properties.Task?.title?.[0]?.plain_text || 'Untitled');

    // Get AI reflection
    const summary = `
Today's results:
- Completed: ${completedCount} tasks
- Remaining: ${remainingCount} tasks
- Tomorrow: ${tomorrowCount} tasks due

Completed today:
${completedTitles.map((t) => `- ${t}`).join('\n')}

Still urgent:
${remainingUrgent.map((t) => `- ${t}`).join('\n')}

Tomorrow's tasks:
${tomorrowTop.map((t) => `- ${t}`).join('\n')}
`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: `You are a thoughtful productivity coach. Based on today's work, provide:
1. Brief acknowledgment of what was accomplished (1 sentence)
2. Gentle reminder about urgent items (if any)
3. One tip for tomorrow
4. Encouraging sign-off

Keep it warm, concise, and actionable. Format as plain text, no markdown.

${summary}`,
        },
      ],
    });

    const aiReflection =
      aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

    // Build notification
    const dashboardUrl = 'https://tomos-task-api.vercel.app';

    let notificationBody = `🌙 End of Day Summary

✅ Completed today: ${completedCount}
📋 Remaining: ${remainingCount}
📅 Tomorrow: ${tomorrowCount} tasks due`;

    if (completedCount > 0) {
      notificationBody += `\n\n🎉 Today's wins:\n${completedTitles
        .slice(0, 3)
        .map((t) => `• ${t}`)
        .join('\n')}`;
    }

    if (remainingUrgent.length > 0) {
      notificationBody += `\n\n⚠️ Still urgent:\n${remainingUrgent
        .map((t) => `• ${t}`)
        .join('\n')}`;
    }

    if (tomorrowCount > 0) {
      notificationBody += `\n\n📅 Tomorrow's preview:\n${tomorrowTop
        .map((t) => `• ${t}`)
        .join('\n')}`;
    }

    notificationBody += `\n\n🤖 ${aiReflection}\n\n👉 View Dashboard`;

    // Send APNs push notification to iOS/macOS devices
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tomos-task-api.vercel.app';

    const pushResponse = await fetch(`${baseUrl}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'End of Day Summary',
        body: notificationBody,
        priority: 'normal',
        badge: remainingCount,
      }),
    });

    const pushResult = await pushResponse.json();
    console.log('EOD summary sent via APNs:', pushResult);

    console.log('EOD summary stats:', {
      completed: completedCount,
      remaining: remainingCount,
      tomorrow: tomorrowCount,
    });

    return NextResponse.json({
      success: true,
      timestamp: sydneyTime.toISOString(),
      completed: completedCount,
      remaining: remainingCount,
      tomorrow: tomorrowCount,
    });
  } catch (error) {
    console.error('Error sending EOD summary:', error);
    return NextResponse.json(
      {
        error: 'Failed to send EOD summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
