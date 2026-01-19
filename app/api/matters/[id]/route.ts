import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters/[id]
 * Get a single matter by ID with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matter = await prisma.matter.findUnique({
      where: { id: params.id },
      include: {
        tasks: {
          orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 20, // Latest 20 documents
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Latest 50 events
        },
        notes: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!matter) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: matter,
    });
  } catch (error) {
    console.error('Error fetching matter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch matter' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/matters/[id]
 * Update a matter
 * Body: any matter fields to update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Check if matter exists
    const existing = await prisma.matter.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, title: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.client !== undefined) updateData.client = body.client;
    if (body.matterNumber !== undefined) updateData.matterNumber = body.matterNumber;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    if (body.budget !== undefined) updateData.budget = body.budget ? parseFloat(body.budget) : null;
    if (body.actualSpend !== undefined) updateData.actualSpend = body.actualSpend ? parseFloat(body.actualSpend) : null;
    if (body.billingStatus !== undefined) updateData.billingStatus = body.billingStatus;
    if (body.clientContact !== undefined) updateData.clientContact = body.clientContact;
    if (body.leadCounsel !== undefined) updateData.leadCounsel = body.leadCounsel;
    if (body.teamMembers !== undefined) updateData.teamMembers = body.teamMembers;
    if (body.externalCounsel !== undefined) updateData.externalCounsel = body.externalCounsel;
    if (body.practiceArea !== undefined) updateData.practiceArea = body.practiceArea;
    if (body.jurisdiction !== undefined) updateData.jurisdiction = body.jurisdiction;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Handle status change
    if (body.status !== undefined && body.status !== existing.status) {
      updateData.status = body.status;
      updateData.lastActivityAt = new Date();

      // If marking as completed, set completedAt
      if (body.status === 'completed' && !body.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    // Update matter
    const matter = await prisma.matter.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: {
          select: {
            documents: true,
            events: true,
            notes: true,
            tasks: true,
          },
        },
      },
    });

    // Create event for significant changes
    const eventPromises = [];

    if (body.status !== undefined && body.status !== existing.status) {
      eventPromises.push(
        prisma.matterEvent.create({
          data: {
            matterId: params.id,
            type: 'status_change',
            title: `Status changed to ${body.status}`,
            description: `Matter status changed from ${existing.status} to ${body.status}`,
            actor: body.updatedBy || 'System',
          },
        })
      );
    }

    // Execute event creation in background
    if (eventPromises.length > 0) {
      Promise.all(eventPromises).catch(err =>
        console.error('Error creating matter events:', err)
      );
    }

    return NextResponse.json({
      success: true,
      data: matter,
    });
  } catch (error) {
    console.error('Error updating matter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update matter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/matters/[id]
 * Delete a matter (soft delete by setting status to 'archived')
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if matter exists
    const existing = await prisma.matter.findUnique({
      where: { id: params.id },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Soft delete: archive instead of hard delete
    const matter = await prisma.matter.update({
      where: { id: params.id },
      data: {
        status: 'archived',
        updatedAt: new Date(),
      },
    });

    // Create archive event
    await prisma.matterEvent.create({
      data: {
        matterId: params.id,
        type: 'status_change',
        title: 'Matter archived',
        description: `Matter "${existing.title}" archived`,
        actor: 'System',
      },
    }).catch(err => console.error('Error creating archive event:', err));

    return NextResponse.json({
      success: true,
      data: { id: matter.id, status: matter.status },
      message: 'Matter archived successfully',
    });
  } catch (error) {
    console.error('Error deleting matter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete matter' },
      { status: 500 }
    );
  }
}
