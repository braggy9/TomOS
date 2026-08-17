import { afterEach, describe, expect, it } from 'vitest'
import {
  bearerToken,
  hasCronAccess,
  hasTrainingReadAccess,
  requireTrainingReadAccess,
  secretsMatch,
} from './server-auth'

afterEach(() => {
  delete process.env.CRON_SECRET
  delete process.env.TOMOS_TRAINING_READ_TOKEN
})

describe('server auth', () => {
  it('extracts Bearer tokens case-insensitively', () => {
    const request = new Request('https://example.test', {
      headers: { Authorization: 'bearer training-secret' },
    })
    expect(bearerToken(request)).toBe('training-secret')
  })

  it('compares secrets without direct string equality', () => {
    expect(secretsMatch('same', 'same')).toBe(true)
    expect(secretsMatch('same', 'different')).toBe(false)
    expect(secretsMatch(null, 'same')).toBe(false)
  })

  it('authorises the right credential for each purpose', () => {
    process.env.CRON_SECRET = 'cron-secret'
    process.env.TOMOS_TRAINING_READ_TOKEN = 'training-secret'
    const trainingRequest = new Request('https://example.test', {
      headers: { Authorization: 'Bearer training-secret' },
    })
    const cronRequest = new Request('https://example.test', {
      headers: { Authorization: 'Bearer cron-secret' },
    })
    expect(hasTrainingReadAccess(trainingRequest)).toBe(true)
    expect(hasCronAccess(trainingRequest)).toBe(false)
    expect(hasCronAccess(cronRequest)).toBe(true)
  })

  it('fails closed when the training credential is not configured', () => {
    const response = requireTrainingReadAccess(new Request('https://example.test'))
    expect(response?.status).toBe(503)
  })
})
