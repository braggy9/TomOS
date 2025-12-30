import { NextRequest, NextResponse } from 'next/server';

// Vercel Cron Job - Auto-sync tasks to Google Calendar every hour
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

    if (!refreshToken) {
      console.log('Cron: Google Calendar refresh token not configured, skipping sync');
      return NextResponse.json({
        skipped: true,
        reason: 'Google Calendar not configured',
      });
    }

    console.log('Cron: Starting automated calendar sync...');

    // Call the sync endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://tomos-task-api.vercel.app';

    const response = await fetch(`${baseUrl}/api/calendar/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync',
        refreshToken,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Cron: Calendar sync failed:', result);
      return NextResponse.json({
        success: false,
        error: result.error || 'Sync failed',
      }, { status: 500 });
    }

    console.log('Cron: Calendar sync completed:', result);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('Cron: Error in automated calendar sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync calendar',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
