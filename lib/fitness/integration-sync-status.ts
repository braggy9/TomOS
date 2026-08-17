import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

export const STRAVA_SYNC_PROVIDER = 'strava'
export const STRAVA_STALE_AFTER_HOURS = 36

type SyncResult = Record<string, string | number | boolean | null>

export function isIntegrationSyncStale(
  lastSuccessAt: Date | string | null | undefined,
  now = new Date(),
  staleAfterHours = STRAVA_STALE_AFTER_HOURS
): boolean {
  if (!lastSuccessAt) return true

  const lastSuccess = new Date(lastSuccessAt)
  if (Number.isNaN(lastSuccess.getTime())) return true

  return now.getTime() - lastSuccess.getTime() > staleAfterHours * 60 * 60 * 1000
}

export async function recordIntegrationSyncAttempt(
  provider: string,
  result: SyncResult
): Promise<void> {
  try {
    await prisma.integrationSyncStatus.upsert({
      where: { provider },
      create: {
        id: provider,
        provider,
        lastAttemptAt: new Date(),
        lastResult: result as Prisma.InputJsonValue,
      },
      update: {
        lastAttemptAt: new Date(),
        lastResult: result as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.error(`Failed to record ${provider} sync attempt:`, error)
  }
}

export async function recordIntegrationSyncSuccess(
  provider: string,
  result: SyncResult
): Promise<void> {
  try {
    const now = new Date()
    await prisma.integrationSyncStatus.upsert({
      where: { provider },
      create: {
        id: provider,
        provider,
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastResult: result as Prisma.InputJsonValue,
      },
      update: {
        lastSuccessAt: now,
        lastError: null,
        lastResult: result as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.error(`Failed to record ${provider} sync success:`, error)
  }
}

export async function recordIntegrationSyncFailure(
  provider: string,
  error: unknown,
  result: SyncResult
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.integrationSyncStatus.upsert({
      where: { provider },
      create: {
        id: provider,
        provider,
        lastAttemptAt: new Date(),
        lastError: message,
        lastResult: result as Prisma.InputJsonValue,
      },
      update: {
        lastError: message,
        lastResult: result as Prisma.InputJsonValue,
      },
    })
  } catch (statusError) {
    console.error(`Failed to record ${provider} sync failure:`, statusError)
  }
}
