import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters/[id]/documents/[documentId]
 * Get a single document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const document = await prisma.matterDocument.findUnique({
      where: {
        id: params.documentId,
        matterId: params.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/matters/[id]/documents/[documentId]
 * Update a document
 * Body: any document fields to update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const body = await request.json();

    // Check if document exists
    const existing = await prisma.matterDocument.findUnique({
      where: {
        id: params.documentId,
        matterId: params.id,
      },
      select: { id: true, title: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.fileUrl !== undefined) updateData.fileUrl = body.fileUrl;
    if (body.localPath !== undefined) updateData.localPath = body.localPath;
    if (body.version !== undefined) updateData.version = body.version;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.author !== undefined) updateData.author = body.author;
    if (body.reviewedBy !== undefined) updateData.reviewedBy = body.reviewedBy;
    if (body.signedAt !== undefined) updateData.signedAt = body.signedAt ? new Date(body.signedAt) : null;
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    // Update document
    const document = await prisma.matterDocument.update({
      where: { id: params.documentId },
      data: updateData,
    });

    // Update matter's lastActivityAt
    await prisma.matter.update({
      where: { id: params.id },
      data: { lastActivityAt: new Date() },
    }).catch(err => console.error('Error updating matter activity:', err));

    // Create event for significant changes
    if (body.status !== undefined && body.status !== existing.status) {
      await prisma.matterEvent.create({
        data: {
          matterId: params.id,
          type: 'document_added',
          title: 'Document status changed',
          description: `Document "${existing.title}" status changed to ${body.status}`,
          actor: body.reviewedBy || 'System',
        },
      }).catch(err => console.error('Error creating document event:', err));
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/matters/[id]/documents/[documentId]
 * Delete a document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    // Check if document exists
    const existing = await prisma.matterDocument.findUnique({
      where: {
        id: params.documentId,
        matterId: params.id,
      },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete document
    await prisma.matterDocument.delete({
      where: { id: params.documentId },
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
        type: 'document_added',
        title: 'Document removed',
        description: `Document "${existing.title}" removed from matter`,
        actor: 'System',
      },
    }).catch(err => console.error('Error creating document event:', err));

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
