import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/journal/entries/[id] - Get single entry with conversations
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/journal/entries/[id] - Update entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updateData: any = {};

    if (body.content !== undefined) {
      updateData.content = body.content.trim();
      updateData.wordCount = updateData.content.split(/\s+/).filter(Boolean).length;
      updateData.excerpt = updateData.content.substring(0, 200).replace(/[#*`_\[\]]/g, '').trim();
    }
    if (body.title !== undefined) updateData.title = body.title;
    if (body.mood !== undefined) updateData.mood = body.mood;
    if (body.energy !== undefined) updateData.energy = body.energy;
    if (body.themes !== undefined) updateData.themes = body.themes;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.reflection !== undefined) updateData.reflection = body.reflection;
    if (body.entryDate !== undefined) updateData.entryDate = new Date(body.entryDate);

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to update journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/journal/entries/[id] - Delete entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.journalEntry.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Journal entry deleted',
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
