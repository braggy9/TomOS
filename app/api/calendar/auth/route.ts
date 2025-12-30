import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://tomos-task-api.vercel.app/api/calendar/callback';

export async function GET(request: NextRequest) {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google Calendar credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: [
        'https://www.googleapis.com/auth/calendar.events', // Manage calendar events
        'https://www.googleapis.com/auth/calendar.readonly', // Read calendar
      ],
      prompt: 'consent', // Force consent screen to get refresh token
    });

    // Redirect to Google OAuth page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start authorization' },
      { status: 500 }
    );
  }
}
