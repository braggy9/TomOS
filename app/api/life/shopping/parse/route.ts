import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/life/shopping/parse
 * NLP parse: "milk, 2kg chicken, bunch of bananas" → structured items
 * Body: { text: string, listId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, listId } = body

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'text is required' },
        { status: 400 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Parse this shopping list text into structured items. Return ONLY a JSON array, no markdown.

Each item should have:
- "name": the item name (cleaned up, lowercase)
- "quantity": quantity if mentioned (e.g., "2kg", "3", "bunch of"), or null
- "category": one of: produce, dairy, meat, pantry, household, other

Text: "${text}"

Respond with ONLY the JSON array, e.g.:
[{"name": "milk", "quantity": "2L", "category": "dairy"}]`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let parsedItems: Array<{ name: string; quantity?: string; category?: string }>

    try {
      parsedItems = JSON.parse(responseText)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response', raw: responseText },
        { status: 500 }
      )
    }

    // Create all items in a transaction
    const created = await prisma.$transaction(
      parsedItems.map((item, index) =>
        prisma.shoppingItem.create({
          data: {
            name: item.name,
            quantity: item.quantity || null,
            category: item.category || 'other',
            listId: listId || null,
            sortOrder: index,
          },
        })
      )
    )

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error parsing shopping list:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to parse shopping list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
