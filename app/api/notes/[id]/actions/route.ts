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
      links: original.links as any, // Type assertion for JSON field
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

// Convert note to Todoist task
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

  const todoistApiKey = process.env.TODOIST_API_KEY;
  if (!todoistApiKey) {
    return NextResponse.json(
      { error: 'TODOIST_API_KEY not configured' },
      { status: 503 }
    );
  }

  // Map priority: urgent→p1, high→p2, medium→p3, low→p4
  const priorityMap: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
  const todoistPriority = priorityMap[note.priority ?? 'medium'] ?? 3;

  const todoistRes = await fetch('https://api.todoist.com/rest/v2/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${todoistApiKey}`,
    },
    body: JSON.stringify({
      content: note.title,
      description: note.content ? note.content.slice(0, 1000) : undefined,
      priority: todoistPriority,
    }),
  });

  if (!todoistRes.ok) {
    const err = await todoistRes.text();
    console.error('[notes/actions] Todoist API error:', err);
    return NextResponse.json({ error: 'Failed to create Todoist task' }, { status: 502 });
  }

  const todoistTask = await todoistRes.json();

  // Archive the note
  await prisma.note.update({
    where: { id: noteId },
    data: { status: 'archived' }
  });

  return NextResponse.json({
    success: true,
    action: 'convert-to-task',
    data: {
      note: { id: note.id, title: note.title },
      task: { id: todoistTask.id, content: todoistTask.content, url: todoistTask.url }
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
