import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isIntegrationSyncStale,
  STRAVA_STALE_AFTER_HOURS,
  STRAVA_SYNC_PROVIDER,
} from '@/lib/fitness/integration-sync-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [status, latestRun] = await Promise.all([
    prisma.integrationSyncStatus.findUnique({
      where: { provider: STRAVA_SYNC_PROVIDER },
    }),
    prisma.runningSync.findFirst({
      where: { source: STRAVA_SYNC_PROVIDER },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ])

  return NextResponse.json(
    {
      success: true,
      data: {
        provider: STRAVA_SYNC_PROVIDER,
        lastAttemptAt: status?.lastAttemptAt ?? null,
        lastSuccessAt: status?.lastSuccessAt ?? null,
        latestActivityAt: latestRun?.date ?? null,
        lastError: status?.lastError ?? null,
        lastResult: status?.lastResult ?? null,
        staleAfterHours: STRAVA_STALE_AFTER_HOURS,
        stale: isIntegrationSyncStale(status?.lastSuccessAt),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

