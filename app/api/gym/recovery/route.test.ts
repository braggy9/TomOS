import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const recoveryCheckIn = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: { recoveryCheckIn } }))

import { GET, POST } from './route'

describe('recovery route Sydney date handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T13:30:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies days and limit to the history query', async () => {
    recoveryCheckIn.findMany.mockResolvedValue([])

    const response = await GET(new NextRequest('https://example.com/api/gym/recovery?days=7&limit=5'))

    expect(response.status).toBe(200)
    expect(recoveryCheckIn.findMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-08-12T14:00:00.000Z'),
          lte: new Date('2026-08-19T13:59:59.999Z'),
        },
      },
      orderBy: { date: 'desc' },
      take: 5,
    })
  })

  it('uses AEST bounds for a late-night Sydney upsert', async () => {
    const existing = {
      id: 'recovery-1',
      date: new Date('2026-08-19T01:00:00.000Z'),
      sleepQuality: 3,
      soreness: 4,
      energy: 3,
      motivation: 4,
      hoursSlept: null,
      notes: null,
      readinessScore: 3.5,
      createdAt: new Date('2026-08-19T01:00:00.000Z'),
    }
    recoveryCheckIn.findFirst.mockResolvedValue(existing)
    recoveryCheckIn.update.mockResolvedValue(existing)

    const response = await POST(new NextRequest('https://example.com/api/gym/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sleepQuality: 3, soreness: 4, energy: 3, motivation: 4 }),
    }))

    expect(response.status).toBe(200)
    expect(recoveryCheckIn.findFirst).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-08-18T14:00:00.000Z'),
          lte: new Date('2026-08-19T13:59:59.999Z'),
        },
      },
    })
    expect(recoveryCheckIn.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ readinessScore: 3.5 }),
    }))
  })
})
