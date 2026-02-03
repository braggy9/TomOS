import { NextRequest, NextResponse } from 'next/server'
import { getSessionSuggestion } from '@/lib/fitness/suggestions'
import type { WeekType } from '@/types/fitness'

/**
 * GET /api/gym/suggest
 * Get a session recommendation with exercise-level weight suggestions
 * Query params: weekType ("kid" | "non-kid")
 */
export async function GET(request: NextRequest) {
  try {
    const weekType = request.nextUrl.searchParams.get('weekType') as WeekType | null

    const suggestion = await getSessionSuggestion(weekType || undefined)

    return NextResponse.json({ success: true, data: suggestion })
  } catch (error) {
    console.error('Error generating suggestion:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate suggestion' },
      { status: 500 }
    )
  }
}
