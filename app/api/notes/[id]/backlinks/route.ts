import { NextRequest, NextResponse } from 'next/server';
import { getBacklinks } from '@/lib/smartLinking';

// GET /api/notes/[id]/backlinks - Get all notes that link to this note
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const backlinks = await getBacklinks(params.id);

    return NextResponse.json({
      success: true,
      data: {
        noteId: params.id,
        backlinks,
        count: backlinks.length
      }
    });

  } catch (error) {
    console.error('Error fetching backlinks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backlinks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
