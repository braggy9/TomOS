import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/life/shopping/[id]
 * Update a shopping item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, quantity, category, checked, sortOrder, listId } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (quantity !== undefined) data.quantity = quantity
    if (category !== undefined) data.category = category
    if (checked !== undefined) data.checked = checked
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (listId !== undefined) data.listId = listId

    const item = await prisma.shoppingItem.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('Error updating shopping item:', error)
    return NextResponse.json({ success: false, error: 'Failed to update shopping item' }, { status: 500 })
  }
}

/**
 * DELETE /api/life/shopping/[id]
 * Remove a shopping item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.shoppingItem.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shopping item:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete shopping item' }, { status: 500 })
  }
}
