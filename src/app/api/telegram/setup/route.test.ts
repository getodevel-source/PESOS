import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

// Capture every fetch call so we can assert that setWebhook is never invoked.
const fetchCalls: string[] = []

beforeEach(() => {
  fetchCalls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetchCalls.push(url)

    // Only getMe is allowed. setWebhook is what the route MUST stop calling.
    if (url.includes('/getMe')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: { username: 'pesito_bot', first_name: 'Pesito' },
        }),
      } as Response
    }

    return {
      ok: false,
      json: async () => ({ ok: false, description: 'unexpected fetch in test' }),
    } as Response
  }) as typeof fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Telegram Setup Route Handler (Δ1 — setWebhook removed)', () => {
  it('returns a deprecation note and never calls setWebhook', async () => {
    const request = new NextRequest('http://localhost/api/telegram/setup', {
      method: 'POST',
      body: JSON.stringify({
        botToken: 'TEST_BOT_TOKEN',
        origin: 'https://pesos.example.com',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    // The route MUST still validate the bot via getMe.
    expect(fetchCalls.some((u) => u.includes('/getMe'))).toBe(true)
    // The route MUST NOT call setWebhook — that's the whole point of Δ1.
    expect(fetchCalls.some((u) => u.includes('/setWebhook'))).toBe(false)

    // The response MUST include the deprecation contract.
    expect(json).toMatchObject({
      deprecated: true,
      username: 'pesito_bot',
      name: 'Pesito',
    })
    expect(typeof json.message).toBe('string')
    expect(json.message.length).toBeGreaterThan(0)
  })
})
