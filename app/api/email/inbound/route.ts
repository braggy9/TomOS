import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/email/inbound
 * Resend inbound email webhook → routes to task, new matter, or matter note.
 *
 * Routing rules (checked in order):
 *   1. Subject starts with "[MATTER]" or "MATTER:"
 *      → Create a new matter (client extracted from body or defaults to "Publicis")
 *   2. Subject contains a matter number pattern (#PUB-XXXX, #MAT-XXXX, etc.)
 *      → Add a note to the matching existing matter
 *   3. Everything else
 *      → Create a task via NLP parsing (existing behaviour)
 */

const MATTER_NUMBER_RE = /#([A-Z]{2,6}-\d{4}-\d{3,})/i
const MATTER_PREFIX_RE = /^\[?MATTER\]?:?\s*/i

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractBody(payload: ResendPayload): string {
  if (payload.text?.trim()) return payload.text.trim()
  if (payload.html) return stripHtml(payload.html)
  return payload.subject
}

/** Try to extract a client name from the email body (first non-empty line). */
function guessClient(body: string, from: string): string {
  const firstLine = body.split('\n').find((l) => l.trim().length > 3)
  if (firstLine && firstLine.length < 80) return firstLine.trim()
  // Fall back to sender domain
  const domain = from.split('@')[1]?.split('.')[0]
  return domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : 'Publicis'
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResendPayload {
  from: string
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let payload: ResendPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { from, subject } = payload
  if (!from || !subject) {
    return NextResponse.json({ error: 'Missing from or subject' }, { status: 400 })
  }

  const body = extractBody(payload)
  const cleanSubject = subject.trim()

  // ── Route 1: New matter ────────────────────────────────────────────────────
  if (MATTER_PREFIX_RE.test(cleanSubject)) {
    const title = cleanSubject.replace(MATTER_PREFIX_RE, '').trim() || cleanSubject
    const client = guessClient(body, from)

    const matter = await prisma.matter.create({
      data: {
        title,
        description: body,
        client,
        type: 'advisory',
        status: 'active',
        priority: 'medium',
        leadCounsel: 'Tom Bragg',
        tags: ['email-intake'],
      },
    })

    return NextResponse.json({
      success: true,
      route: 'new_matter',
      from,
      subject,
      matterId: matter.id,
      matterTitle: matter.title,
      client: matter.client,
    })
  }

  // ── Route 2: Note on existing matter ──────────────────────────────────────
  const matterNumberMatch = cleanSubject.match(MATTER_NUMBER_RE)
  if (matterNumberMatch) {
    const matterNumber = matterNumberMatch[1].toUpperCase()

    const matter = await prisma.matter.findFirst({
      where: { matterNumber: { equals: matterNumber, mode: 'insensitive' } },
    })

    if (matter) {
      const note = await prisma.matterNote.create({
        data: {
          matterId: matter.id,
          title: cleanSubject,
          content: body,
          type: 'general',
          author: from,
          tags: ['email'],
        },
      })

      // Bump lastActivityAt
      await prisma.matter.update({
        where: { id: matter.id },
        data: { lastActivityAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        route: 'matter_note',
        from,
        subject,
        matterId: matter.id,
        matterTitle: matter.title,
        noteId: note.id,
      })
    }
    // Matter number not found — fall through to task creation
  }

  // ── Route 3: Task (default) ────────────────────────────────────────────────
  const taskText = body || cleanSubject
  const taskRes = await fetch(
    'https://tomos-task-api.vercel.app/api/task',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: taskText,
        source: `Email (${from})`,
      }),
    }
  )

  const taskResult = await taskRes.json()

  return NextResponse.json({
    success: true,
    route: 'task',
    from,
    subject,
    taskId: taskResult.taskId,
    parsedTask: taskResult.parsedTask,
  })
}
