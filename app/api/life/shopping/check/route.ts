import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/life/shopping/check
 * Toggle checked status for one or multiple items
 * Body: { id: string } or { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids: string[] = body.ids || (body.id ? [body.id] : [])

    if (!ids.length) {
      return NextResponse.json(
        { success: false, error: 'id or ids required' },
        { status: 400 }
      )
    }

    // Get current state to toggle
    const items = await prisma.shoppingItem.findMany({
      where: { id: { in: ids } },
    })

    const results = await prisma.$transaction(
      items.map((item) =>
        prisma.shoppingItem.update({
          where: { id: item.id },
          data: { checked: !item.checked },
        })
      )
    )

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Error toggling shopping items:', error)
    return NextResponse.json({ success: false, error: 'Failed to toggle items' }, { status: 500 })
  }
}
