import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/life/shopping/clear
 * Clear all checked items (delete all checked=true)
 * Body: { listId?: string } — optional, defaults to default list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const listId = body.listId || null

    const result = await prisma.shoppingItem.deleteMany({
      where: {
        checked: true,
        listId,
      },
    })

    return NextResponse.json({
      success: true,
      data: { cleared: result.count },
    })
  } catch (error) {
    console.error('Error clearing checked items:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear items' }, { status: 500 })
  }
}
