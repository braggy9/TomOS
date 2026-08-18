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
    process.env.TOMOS_TRAINING_READ_TOKEN = 'training-secret'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T13:30:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.TOMOS_TRAINING_READ_TOKEN
    vi.useRealTimers()
  })

  function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', 'Bearer training-secret')

    return new NextRequest(`https://example.com${path}`, {
      ...init,
      headers,
    })
  }

  it('rejects unauthenticated history reads before querying recovery data', async () => {
    const response = await GET(new NextRequest('https://example.com/api/gym/recovery'))

    expect(response.status).toBe(401)
    expect(recoveryCheckIn.findMany).not.toHaveBeenCalled()
  })

  it('fails closed when the backend training token is not configured', async () => {
    delete process.env.TOMOS_TRAINING_READ_TOKEN

    const response = await GET(new NextRequest('https://example.com/api/gym/recovery'))

    expect(response.status).toBe(503)
    expect(recoveryCheckIn.findMany).not.toHaveBeenCalled()
  })

  it('applies days and limit to the history query', async () => {
    recoveryCheckIn.findMany.mockResolvedValue([])

    const response = await GET(request('/api/gym/recovery?days=7&limit=5'))

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

    const response = await POST(request('/api/gym/recovery', {
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

  it.each([
    { sleepQuality: 0, soreness: 3, energy: 3, motivation: 3 },
    { sleepQuality: 3.5, soreness: 3, energy: 3, motivation: 3 },
    { sleepQuality: 3, soreness: 6, energy: 3, motivation: 3 },
    { sleepQuality: 3, soreness: 3, energy: 3, motivation: 'excellent' },
  ])('rejects invalid recovery input without querying the database: %j', async (body) => {
    const response = await POST(request('/api/gym/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))

    expect(response.status).toBe(400)
    expect(recoveryCheckIn.findFirst).not.toHaveBeenCalled()
    expect(recoveryCheckIn.create).not.toHaveBeenCalled()
    expect(recoveryCheckIn.update).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated writes before parsing the body', async () => {
    const response = await POST(new NextRequest('https://example.com/api/gym/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sleepQuality: 3, soreness: 3, energy: 3, motivation: 3 }),
    }))

    expect(response.status).toBe(401)
    expect(recoveryCheckIn.findFirst).not.toHaveBeenCalled()
  })

  it('rejects unknown fields without querying the database', async () => {
    const response = await POST(request('/api/gym/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sleepQuality: 3,
        soreness: 3,
        energy: 3,
        motivation: 3,
        unexpected: true,
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ field: 'body' })
    expect(recoveryCheckIn.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON without querying the database', async () => {
    const response = await POST(request('/api/gym/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, error: 'Invalid JSON' })
    expect(recoveryCheckIn.findFirst).not.toHaveBeenCalled()
  })

  it('preserves the supported string input contract after validation', async () => {
    const created = {
      id: 'recovery-2',
      date: new Date('2026-08-19T13:30:00.000Z'),
      sleepQuality: 5,
      soreness: 3,
      energy: 1,
      motivation: 5,
      hoursSlept: null,
      notes: null,
      readinessScore: 3.5,
      createdAt: new Date('2026-08-19T13:30:00.000Z'),
    }
    recoveryCheckIn.findFirst.mockResolvedValue(null)
    recoveryCheckIn.create.mockResolvedValue(created)

    const response = await POST(request('/api/gym/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sleepQuality: 'great',
        soreness: 'mild',
        energy: 'low',
        motivation: 'high',
      }),
    }))

    expect(response.status).toBe(201)
    expect(recoveryCheckIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sleepQuality: 5,
        soreness: 3,
        energy: 1,
        motivation: 5,
        readinessScore: 3.5,
      }),
    })
  })
})
