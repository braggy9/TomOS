import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const recoveryCheckIn = vi.hoisted(() => ({ findFirst: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: { recoveryCheckIn } }))

import { GET } from './route'

describe('today recovery route', () => {
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

  it('rejects unauthenticated reads', async () => {
    const response = await GET(new Request('https://example.com/api/gym/recovery/today'))

    expect(response.status).toBe(401)
    expect(recoveryCheckIn.findFirst).not.toHaveBeenCalled()
  })

  it('queries the exact current Sydney day for authenticated reads', async () => {
    recoveryCheckIn.findFirst.mockResolvedValue(null)

    const response = await GET(new Request('https://example.com/api/gym/recovery/today', {
      headers: { Authorization: 'Bearer training-secret' },
    }))

    expect(response.status).toBe(200)
    expect(recoveryCheckIn.findFirst).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-08-18T14:00:00.000Z'),
          lte: new Date('2026-08-19T13:59:59.999Z'),
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })
})
