import { NextRequest, NextResponse } from 'next/server';

/**
 * Focus Mode State API
 *
 * Stores and retrieves the current macOS Focus Mode state.
 * iOS Shortcuts Automation calls this endpoint when Focus Mode changes.
 */

// In-memory storage (consider Redis or DB for production)
let currentFocusMode: string = 'None';
let lastUpdated: string = new Date().toISOString();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { focusMode } = body;

    if (!focusMode || typeof focusMode !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request. Provide focusMode as string.' },
        { status: 400 }
      );
    }

    // Update current Focus Mode
    currentFocusMode = focusMode;
    lastUpdated = new Date().toISOString();

    console.log(`Focus Mode updated: ${focusMode} at ${lastUpdated}`);

    return NextResponse.json({
      success: true,
      focusMode: currentFocusMode,
      lastUpdated,
    });
  } catch (error) {
    console.error('Error updating Focus Mode:', error);
    return NextResponse.json(
      { error: 'Failed to update Focus Mode' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      focusMode: currentFocusMode,
      lastUpdated,
    });
  } catch (error) {
    console.error('Error retrieving Focus Mode:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Focus Mode' },
      { status: 500 }
    );
  }
}
