import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tasks
 * List tasks with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { parentId: null };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          tags: { include: { tag: true } },
          project: { select: { id: true, title: true, color: true } },
          children: { select: { id: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    const statusMap: Record<string, string> = {
      'todo': 'Inbox',
      'in_progress': 'In Progress',
      'done': 'Done',
    };
    const priorityMap: Record<string, string> = {
      'urgent': 'Urgent',
      'high': 'Important',
      'medium': 'Important',
      'low': 'Someday',
    };

    const formatted = tasks.map((task: any) => {
      const tagNames: string[] = task.tags?.map((tt: any) => tt.tag?.name ?? tt.name) ?? [];
      const context = tagNames.filter((t) => t.startsWith('context:')).map((t) => t.replace('context:', ''));
      const energyTag = tagNames.find((t) => t.startsWith('energy:'));
      const timeTag = tagNames.find((t) => t.startsWith('time:'));
      return {
        ...task,
        status: statusMap[task.status] ?? task.status,
        priority: priorityMap[task.priority] ?? task.priority,
        context,
        energy: energyTag ? energyTag.replace('energy:', '') : null,
        time: timeTag ? timeTag.replace('time:', '') : null,
        subtaskCount: task.children?.length ?? 0,
        dueDate: task.dueDate?.toISOString?.() ?? task.dueDate ?? null,
        completedAt: task.completedAt?.toISOString?.() ?? task.completedAt ?? null,
        createdAt: task.createdAt?.toISOString?.() ?? task.createdAt,
        updatedAt: task.updatedAt?.toISOString?.() ?? task.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      tasks: formatted,
      pagination: { total, limit, offset, hasMore: offset + tasks.length < total },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

/**
 * POST /api/tasks
 * Create a task from structured fields (no NLP parsing).
 * Use POST /api/task for natural-language task capture via Claude.
 *
 * Body: { title, priority?, context?, due_date?, tags?, description?, parentId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const priorityMap: Record<string, string> = {
      urgent: 'urgent',
      high: 'high',
      medium: 'medium',
      low: 'low',
      // legacy aliases from CC skill
      important: 'high',
      someday: 'low',
    };
    const priority = priorityMap[(body.priority || 'medium').toLowerCase()] ?? 'medium';

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        status: 'todo',
        priority,
        dueDate: body.due_date ? new Date(body.due_date) : null,
        parentId: body.parentId || null,
      },
    });

    // Build tags: user tags + context tag if provided
    const rawTags: string[] = [...(body.tags || [])];
    if (body.context) rawTags.push(`context:${body.context}`);

    for (const tagName of [...new Set(rawTags)]) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      });
      await prisma.taskTag.create({ data: { taskId: task.id, tagId: tag.id } });
    }

    const created = await prisma.task.findUnique({
      where: { id: task.id },
      include: { tags: { include: { tag: true } } },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
