import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters/[id]/notes/[noteId]
 * Get a single note
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const note = await prisma.matterNote.findUnique({
      where: {
        id: params.noteId,
        matterId: params.id,
      },
    });

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: note,
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/matters/[id]/notes/[noteId]
 * Update a note
 * Body: any note fields to update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const body = await request.json();

    // Check if note exists
    const existing = await prisma.matterNote.findUnique({
      where: {
        id: params.noteId,
        matterId: params.id,
      },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.author !== undefined) updateData.author = body.author;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Update note
    const note = await prisma.matterNote.update({
      where: { id: params.noteId },
      data: updateData,
    });

    // Update matter's lastActivityAt
    await prisma.matter.update({
      where: { id: params.id },
      data: { lastActivityAt: new Date() },
    }).catch(err => console.error('Error updating matter activity:', err));

    return NextResponse.json({
      success: true,
      data: note,
    });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/matters/[id]/notes/[noteId]
 * Delete a note
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    // Check if note exists
    const existing = await prisma.matterNote.findUnique({
      where: {
        id: params.noteId,
        matterId: params.id,
      },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    // Delete note
    await prisma.matterNote.delete({
      where: { id: params.noteId },
    });

    // Update matter's lastActivityAt
    await prisma.matter.update({
      where: { id: params.id },
      data: { lastActivityAt: new Date() },
    }).catch(err => console.error('Error updating matter activity:', err));

    // Create event
    await prisma.matterEvent.create({
      data: {
        matterId: params.id,
        type: 'note_added',
        title: 'Note removed',
        description: existing.title
          ? `Note "${existing.title}" removed`
          : 'Note removed from matter',
        actor: 'System',
      },
    }).catch(err => console.error('Error creating note event:', err));

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
