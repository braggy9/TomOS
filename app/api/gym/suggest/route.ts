import { NextRequest, NextResponse } from 'next/server'
import { getSessionSuggestion } from '@/lib/fitness/suggestions'
import type { WeekType } from '@/types/fitness'

/**
 * GET /api/gym/suggest
 * Get a session recommendation with exercise-level weight suggestions
 * Query params:
 *   weekType ("kid" | "non-kid")
 *   equipment (comma-separated, e.g. "dumbbell,kettlebell,bodyweight") — filters Session C exercises
 */
export async function GET(request: NextRequest) {
  try {
    const weekType = request.nextUrl.searchParams.get('weekType') as WeekType | null
    const equipmentParam = request.nextUrl.searchParams.get('equipment')
    const equipment = equipmentParam ? equipmentParam.split(',').map(s => s.trim()) : undefined

    const suggestion = await getSessionSuggestion(weekType || undefined, equipment)

    return NextResponse.json({ success: true, data: suggestion })
  } catch (error) {
    console.error('Error generating suggestion:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate suggestion' },
      { status: 500 }
    )
  }
}
