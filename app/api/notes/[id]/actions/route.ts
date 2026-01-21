import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/notes/[id]/actions - Perform actions on notes
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'duplicate':
        return await duplicateNote(params.id);

      case 'archive':
        return await archiveNote(params.id);

      case 'unarchive':
        return await unarchiveNote(params.id);

      case 'convert-to-task':
        return await convertToTask(params.id, body.context);

      case 'set-review-date':
        return await setReviewDate(params.id, body.days);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error performing note action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Duplicate a note
async function duplicateNote(noteId: string) {
  const original = await prisma.note.findUnique({
    where: { id: noteId }
  });

  if (!original) {
    return NextResponse.json(
      { error: 'Note not found' },
      { status: 404 }
    );
  }

  const duplicate = await prisma.note.create({
    data: {
      title: `${original.title} (Copy)`,
      content: original.content,
      excerpt: original.excerpt,
      tags: original.tags,
      isPinned: false, // Don't copy pinned status
      priority: original.priority,
      status: 'draft', // New copy starts as draft
      confidential: original.confidential,
      links: original.links,
      // Don't copy relations
      taskId: null,
      matterId: null,
      projectId: null
    },
    include: {
      task: true,
      matter: true,
      project: true
    }
  });

  return NextResponse.json({
    success: true,
    action: 'duplicate',
    data: {
      original: { id: original.id, title: original.title },
      duplicate
    }
  });
}

// Archive a note
async function archiveNote(noteId: string) {
  const note = await prisma.note.update({
    where: { id: noteId },
    data: {
      status: 'archived',
      isPinned: false // Unpin when archiving
    }
  });

  return NextResponse.json({
    success: true,
    action: 'archive',
    data: note
  });
}

// Unarchive a note
async function unarchiveNote(noteId: string) {
  const note = await prisma.note.update({
    where: { id: noteId },
    data: {
      status: 'active'
    }
  });

  return NextResponse.json({
    success: true,
    action: 'unarchive',
    data: note
  });
}

// Convert note to task
async function convertToTask(noteId: string, context?: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId }
  });

  if (!note) {
    return NextResponse.json(
      { error: 'Note not found' },
      { status: 404 }
    );
  }

  // Create task from note
  const task = await prisma.task.create({
    data: {
      title: note.title,
      description: note.content,
      status: 'todo',
      priority: note.priority === 'urgent' ? 'urgent' : note.priority === 'high' ? 'important' : 'someday',
      matterId: note.matterId,
      // Add note reference in description
      notes: {
        connect: { id: note.id }
      }
    }
  });

  // Link the note to the created task
  await prisma.note.update({
    where: { id: noteId },
    data: {
      taskId: task.id,
      status: 'archived' // Archive the note since it's now a task
    }
  });

  return NextResponse.json({
    success: true,
    action: 'convert-to-task',
    data: {
      note: { id: note.id, title: note.title },
      task: { id: task.id, title: task.title }
    }
  });
}

// Set review date (for legal research that needs periodic review)
async function setReviewDate(noteId: string, days: number) {
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + (days || 30)); // Default 30 days

  const note = await prisma.note.update({
    where: { id: noteId },
    data: {
      reviewDate
    }
  });

  return NextResponse.json({
    success: true,
    action: 'set-review-date',
    data: {
      noteId: note.id,
      reviewDate: note.reviewDate,
      daysFromNow: days || 30
    }
  });
}
