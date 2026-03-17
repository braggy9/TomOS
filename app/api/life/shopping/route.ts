import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/life/shopping
 * List shopping items with optional filtering
 * Query params: listId, checked, category, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const listId = searchParams.get('listId')
    const checked = searchParams.get('checked')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (listId) where.listId = listId
    else if (!searchParams.has('listId')) where.listId = null // default list
    if (checked !== null && checked !== undefined && checked !== '') {
      where.checked = checked === 'true'
    }
    if (category) where.category = category

    const [items, total] = await Promise.all([
      prisma.shoppingItem.findMany({
        where,
        orderBy: [{ checked: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.shoppingItem.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { total, limit, offset, hasMore: offset + items.length < total },
    })
  } catch (error) {
    console.error('Error fetching shopping items:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch shopping items' }, { status: 500 })
  }
}

/**
 * POST /api/life/shopping
 * Add item(s) — single or array
 * Body: { name, quantity?, category?, listId? } or { items: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Handle single item or array
    const items = body.items || [body]

    if (!items.length || !items[0].name) {
      return NextResponse.json(
        { success: false, error: 'name is required (or items array)' },
        { status: 400 }
      )
    }

    const created = await prisma.$transaction(
      items.map((item: any) =>
        prisma.shoppingItem.create({
          data: {
            name: item.name,
            quantity: item.quantity || null,
            category: item.category || null,
            listId: item.listId || null,
            sortOrder: item.sortOrder || 0,
          },
        })
      )
    )

    return NextResponse.json(
      { success: true, data: items.length === 1 ? created[0] : created },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating shopping item:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create shopping item', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
