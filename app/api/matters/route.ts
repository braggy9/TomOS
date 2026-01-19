import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/matters
 * List all matters with optional filtering
 * Query params: status, priority, client, type, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const client = searchParams.get('client');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (client) where.client = { contains: client, mode: 'insensitive' };
    if (type) where.type = type;

    const [matters, total] = await Promise.all([
      prisma.matter.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { lastActivityAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
            },
          },
          _count: {
            select: {
              documents: true,
              events: true,
              notes: true,
            },
          },
        },
      }),
      prisma.matter.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: matters,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + matters.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching matters:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch matters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/matters
 * Create a new matter
 * Body: { title, description, client, type, status, priority, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Required fields
    if (!body.title || !body.client || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, client, type' },
        { status: 400 }
      );
    }

    // Create matter
    const matter = await prisma.matter.create({
      data: {
        title: body.title,
        description: body.description || null,
        client: body.client,
        matterNumber: body.matterNumber || null,
        type: body.type,
        status: body.status || 'active',
        priority: body.priority || 'medium',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        budget: body.budget ? parseFloat(body.budget) : null,
        billingStatus: body.billingStatus || null,
        clientContact: body.clientContact || null,
        leadCounsel: body.leadCounsel || null,
        teamMembers: body.teamMembers || [],
        externalCounsel: body.externalCounsel || [],
        practiceArea: body.practiceArea || null,
        jurisdiction: body.jurisdiction || null,
        tags: body.tags || [],
      },
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

    // Create initial event
    await prisma.matterEvent.create({
      data: {
        matterId: matter.id,
        type: 'status_change',
        title: 'Matter created',
        description: `Matter "${matter.title}" created for client ${matter.client}`,
        actor: body.createdBy || 'System',
      },
    });

    return NextResponse.json({
      success: true,
      data: matter,
    });
  } catch (error) {
    console.error('Error creating matter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create matter' },
      { status: 500 }
    );
  }
}
