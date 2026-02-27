import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET/POST /api/cron/legal-deadlines
 * Morning cron — scans active matters for upcoming/overdue deadlines
 * and legal-tagged tasks due within 7 days. Sends push notification summary.
 * Protected by CRON_SECRET Bearer token.
 *
 * GET is used by Vercel Cron (Vercel crons always send GET).
 * POST is available for manual triggers / GitHub Actions.
 */
async function handler(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Current time in Sydney
    const sydneyNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })
    )
    const today = new Date(sydneyNow.getFullYear(), sydneyNow.getMonth(), sydneyNow.getDate())

    // 14 days from now (for matter deadlines)
    const in14Days = new Date(today)
    in14Days.setDate(in14Days.getDate() + 14)

    // 7 days from now (for legal tasks)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    // 90 days ago (for stale matters)
    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // ─── Query 1: Active matters with due dates within 14 days or overdue ───
    const mattersWithDeadlines = await prisma.matter.findMany({
      where: {
        status: 'active',
        dueDate: {
          not: null,
          lte: in14Days,
        },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        title: true,
        client: true,
        matterNumber: true,
        dueDate: true,
        priority: true,
        type: true,
      },
    })

    // Split into overdue and upcoming
    const overdue = mattersWithDeadlines.filter(
      (m) => m.dueDate && m.dueDate < today
    )
    const upcoming = mattersWithDeadlines.filter(
      (m) => m.dueDate && m.dueDate >= today
    )

    // ─── Query 2: Active matters stale for 90+ days ───
    const staleMatters = await prisma.matter.findMany({
      where: {
        status: 'active',
        lastActivityAt: {
          lt: ninetyDaysAgo,
        },
      },
      orderBy: { lastActivityAt: 'asc' },
      select: {
        id: true,
        title: true,
        client: true,
        matterNumber: true,
        lastActivityAt: true,
        priority: true,
      },
    })

    // ─── Query 3: Tasks tagged "legal" due within 7 days ───
    const legalTasks = await prisma.task.findMany({
      where: {
        status: { not: 'done' },
        dueDate: {
          not: null,
          lte: in7Days,
        },
        tags: {
          some: {
            tag: {
              name: { equals: 'legal', mode: 'insensitive' },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        matter: {
          select: {
            title: true,
            matterNumber: true,
          },
        },
      },
    })

    // ─── Build summary ───
    const totalItems =
      overdue.length + upcoming.length + staleMatters.length + legalTasks.length

    if (totalItems === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No legal deadlines or stale matters to report',
      })
    }

    // Build push notification text
    const lines: string[] = []

    if (overdue.length > 0) {
      lines.push(`OVERDUE (${overdue.length}):`)
      for (const m of overdue) {
        const daysOverdue = Math.floor(
          (today.getTime() - m.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
        )
        const ref = m.matterNumber || m.client
        lines.push(`  ${m.title} [${ref}] - ${daysOverdue}d overdue`)
      }
    }

    if (upcoming.length > 0) {
      lines.push(`DUE SOON (${upcoming.length}):`)
      for (const m of upcoming) {
        const daysUntil = Math.ceil(
          (m.dueDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        const ref = m.matterNumber || m.client
        const urgency = daysUntil <= 3 ? '!!' : daysUntil <= 7 ? '!' : ''
        lines.push(
          `  ${m.title} [${ref}] - ${daysUntil}d${urgency}`
        )
      }
    }

    if (legalTasks.length > 0) {
      lines.push(`LEGAL TASKS (${legalTasks.length}):`)
      for (const t of legalTasks) {
        const daysUntil = t.dueDate
          ? Math.ceil(
              (t.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            )
          : null
        const due =
          daysUntil !== null
            ? daysUntil < 0
              ? `${Math.abs(daysUntil)}d overdue`
              : daysUntil === 0
                ? 'today'
                : `${daysUntil}d`
            : ''
        const matterRef = t.matter?.matterNumber || t.matter?.title || ''
        lines.push(
          `  ${t.title}${matterRef ? ` [${matterRef}]` : ''} - ${due}`
        )
      }
    }

    if (staleMatters.length > 0) {
      lines.push(`STALE (${staleMatters.length}):`)
      for (const m of staleMatters) {
        const daysSince = Math.floor(
          (today.getTime() - m.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        const ref = m.matterNumber || m.client
        lines.push(`  ${m.title} [${ref}] - ${daysSince}d inactive`)
      }
    }

    const body = lines.join('\n')

    // Build title
    const titleParts: string[] = []
    if (overdue.length > 0) titleParts.push(`${overdue.length} overdue`)
    if (upcoming.length > 0) titleParts.push(`${upcoming.length} due soon`)
    if (legalTasks.length > 0) titleParts.push(`${legalTasks.length} tasks`)
    if (staleMatters.length > 0) titleParts.push(`${staleMatters.length} stale`)
    const title = `Legal: ${titleParts.join(', ')}`

    // ─── Send push notification ───
    const pushUrl = 'https://tomos-task-api.vercel.app/api/send-push'
    const pushRes = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        badge: overdue.length > 0 ? overdue.length : 1,
      }),
    })

    const pushResult = await pushRes.json()

    // ─── Return summary ───
    return NextResponse.json({
      success: true,
      summary: {
        date: today.toISOString().split('T')[0],
        overdue: overdue.map((m) => ({
          id: m.id,
          title: m.title,
          client: m.client,
          matterNumber: m.matterNumber,
          dueDate: m.dueDate,
          priority: m.priority,
          daysOverdue: Math.floor(
            (today.getTime() - m.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
          ),
        })),
        upcoming: upcoming.map((m) => ({
          id: m.id,
          title: m.title,
          client: m.client,
          matterNumber: m.matterNumber,
          dueDate: m.dueDate,
          priority: m.priority,
          daysUntil: Math.ceil(
            (m.dueDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          ),
        })),
        staleMatters: staleMatters.map((m) => ({
          id: m.id,
          title: m.title,
          client: m.client,
          matterNumber: m.matterNumber,
          lastActivityAt: m.lastActivityAt,
          daysSinceActivity: Math.floor(
            (today.getTime() - m.lastActivityAt.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        })),
        legalTasks: legalTasks.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status,
          matter: t.matter,
        })),
        counts: {
          overdue: overdue.length,
          upcoming: upcoming.length,
          staleMatters: staleMatters.length,
          legalTasks: legalTasks.length,
          total: totalItems,
        },
      },
      pushSent: pushResult,
    })
  } catch (error) {
    console.error('Error in legal deadlines cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate legal deadline summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Vercel Cron triggers GET requests
export async function GET(request: NextRequest) {
  return handler(request)
}

// Manual triggers / GitHub Actions use POST
export async function POST(request: NextRequest) {
  return handler(request)
}
