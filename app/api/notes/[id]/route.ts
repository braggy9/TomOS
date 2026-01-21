import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { processSmartLinks } from '@/lib/smartLinking';

const prisma = new PrismaClient();

// GET /api/notes/[id] - Get single note
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const note = await prisma.note.findUnique({
      where: { id: params.id },
      include: {
        task: {
          select: { id: true, title: true, status: true, priority: true }
        },
        matter: {
          select: { id: true, title: true, client: true, status: true }
        },
        project: {
          select: { id: true, title: true, color: true, icon: true }
        }
      }
    });

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: note
    });

  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notes/[id] - Update note
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Build update data object
    const data: any = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) {
      data.content = body.content;
      // Auto-update excerpt when content changes
      if (!body.excerpt) {
        data.excerpt = body.content.substring(0, 200).replace(/[#*`_\[\]]/g, '').trim();
      }
      // Reprocess smart links when content changes
      const { resolvedLinks } = await processSmartLinks(body.content);
      data.links = resolvedLinks;
    }
    if (body.excerpt !== undefined) data.excerpt = body.excerpt;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.isPinned !== undefined) data.isPinned = body.isPinned;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.status !== undefined) data.status = body.status;
    if (body.reviewDate !== undefined) data.reviewDate = body.reviewDate ? new Date(body.reviewDate) : null;
    if (body.confidential !== undefined) data.confidential = body.confidential;
    if (body.taskId !== undefined) data.taskId = body.taskId || null;
    if (body.matterId !== undefined) data.matterId = body.matterId || null;
    if (body.projectId !== undefined) data.projectId = body.projectId || null;

    const note = await prisma.note.update({
      where: { id: params.id },
      data,
      include: {
        task: {
          select: { id: true, title: true }
        },
        matter: {
          select: { id: true, title: true, client: true }
        },
        project: {
          select: { id: true, title: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: note
    });

  } catch (error) {
    console.error('Error updating note:', error);

    if ((error as any).code === 'P2025') {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/notes/[id] - Delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.note.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting note:', error);

    if ((error as any).code === 'P2025') {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
