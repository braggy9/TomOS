import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters/[id]/documents
 * List all documents for a matter
 * Query params: type, status, limit, offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if matter exists
    const matter = await prisma.matter.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!matter) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    const where: any = { matterId: params.id };
    if (type) where.type = type;
    if (status) where.status = status;

    const [documents, total] = await Promise.all([
      prisma.matterDocument.findMany({
        where,
        orderBy: [
          { updatedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.matterDocument.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: documents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + documents.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matters/[id]/documents
 * Create a new document for a matter
 * Body: { title, type, description, fileUrl, version, status, author, ... }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Required fields
    if (!body.title || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, type' },
        { status: 400 }
      );
    }

    // Check if matter exists
    const matter = await prisma.matter.findUnique({
      where: { id: params.id },
      select: { id: true, title: true },
    });

    if (!matter) {
      return NextResponse.json(
        { success: false, error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Create document
    const document = await prisma.matterDocument.create({
      data: {
        matterId: params.id,
        title: body.title,
        type: body.type,
        description: body.description || null,
        fileUrl: body.fileUrl || null,
        localPath: body.localPath || null,
        version: body.version || null,
        status: body.status || null,
        author: body.author || null,
        reviewedBy: body.reviewedBy || null,
        signedAt: body.signedAt ? new Date(body.signedAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    // Update matter's lastActivityAt
    await prisma.matter.update({
      where: { id: params.id },
      data: { lastActivityAt: new Date() },
    });

    // Create event
    await prisma.matterEvent.create({
      data: {
        matterId: params.id,
        type: 'document_added',
        title: 'Document added',
        description: `Document "${body.title}" (${body.type}) added to matter`,
        actor: body.author || 'System',
      },
    }).catch(err => console.error('Error creating document event:', err));

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
