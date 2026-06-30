import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import type { MockQueryChain } from '@/lib/sqlite-db'

vi.mock('@/lib/supabase', () => {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockEq = vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  }))
  const mockSelect = vi.fn(() => ({
    eq: mockEq,
  }))
  const mockThrowOnError = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockInsert = vi.fn(() => ({
    throwOnError: mockThrowOnError,
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  }))
  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = vi.fn(() => ({
    eq: mockUpdateEq,
  }))

  // Default catch-all chain for tables that are neither `profiles` nor
  // `inputs`. Typed as `MockQueryChain<...>` so the read surface used by
  // `route.ts` (select/eq/order/limit/gte/gt + await) type-checks. The
  // remaining methods are stubbed with self-referential `vi.fn(() => ...)`
  // so the type is fully satisfied without expanding the runtime surface
  // (none of the production routes call insert/update/delete/single/
  // maybeSingle/throwOnError on this fallback chain). The `as never` casts
  // on the narrowing methods (insert/update/delete/single/maybeSingle/then)
  // reconcile `defaultQueryMock`'s default `Result = Row[] | null` with the
  // narrower `Result` each of those methods actually returns.
  const defaultQueryMock: MockQueryChain<Record<string, unknown>> = {
    select: vi.fn(() => defaultQueryMock),
    insert: vi.fn(() => defaultQueryMock as never),
    update: vi.fn(() => defaultQueryMock as never),
    delete: vi.fn(() => defaultQueryMock as never),
    eq: vi.fn(() => defaultQueryMock),
    order: vi.fn(() => defaultQueryMock),
    limit: vi.fn(() => defaultQueryMock),
    gte: vi.fn(() => defaultQueryMock),
    gt: vi.fn(() => defaultQueryMock),
    single: vi.fn(() => defaultQueryMock as never),
    maybeSingle: vi.fn(() => defaultQueryMock as never),
    throwOnError: vi.fn(() => defaultQueryMock),
    then: vi.fn((onfulfilled) =>
      Promise.resolve(onfulfilled?.({ data: [], error: null } as never))
    ) as never,
  }

  const mockSupabase = {
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
          update: mockUpdate,
        }
      }
      if (table === 'inputs') {
        return {
          insert: mockInsert,
        }
      }
      return defaultQueryMock
    }),
  }

  return {
    createClient: vi.fn(),
    createServerClientInstance: vi.fn(),
    createAdminClient: vi.fn(() => mockSupabase),
    // Export references to mocks for testing
    _mocks: {
      mockSupabase,
      mockInsert,
      mockThrowOnError,
      mockSelect,
      mockEq,
      mockMaybeSingle,
      mockUpdate,
      mockUpdateEq,
    },
  }
})

// Plain (non-vi.fn) reply shims hoisted above vi.mock so they survive the
// suite's `vi.resetAllMocks()` in beforeEach. They only need to return a
// constant value — no call-history assertions are made on them.
const { openaiCreateCompletion, googleGenerateContent } = vi.hoisted(() => ({
  openaiCreateCompletion: async () => ({
    choices: [{ message: { content: 'Mock reply' } }],
  }),
  googleGenerateContent: async () => ({
    response: { text: () => 'Mock reply' },
  }),
}))

vi.mock('openai', () => {
  class OpenAI {
    chat = { completions: { create: openaiCreateCompletion } }
    constructor(_opts: unknown) {
      // ignore config
    }
  }
  return { default: OpenAI, OpenAI }
})

vi.mock('@google/generative-ai', () => {
  class GoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: googleGenerateContent }
    }
    constructor(_apiKey: unknown) {
      // ignore api key
    }
  }
  return { GoogleGenerativeAI }
})

interface MockedSupabaseModule {
  _mocks: {
    mockInsert: ReturnType<typeof vi.fn>
    mockThrowOnError: ReturnType<typeof vi.fn>
    mockEq: ReturnType<typeof vi.fn>
    mockMaybeSingle: ReturnType<typeof vi.fn>
    mockUpdate: ReturnType<typeof vi.fn>
    mockUpdateEq: ReturnType<typeof vi.fn>
  }
}

// Retrieve mock references from the module
const supabaseMock = (await import('@/lib/supabase')) as unknown as MockedSupabaseModule
const {
  mockInsert,
  mockThrowOnError,
  mockEq,
  mockMaybeSingle,
  mockUpdate,
  mockUpdateEq,
} = supabaseMock._mocks

describe('Telegram Webhook Route Handler', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockThrowOnError.mockResolvedValue({ data: null, error: null })
    process.env = { ...originalEnv, TELEGRAM_BOT_TOKEN: 'test_token' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return 401 if secret query parameter is missing', async () => {
    const request = new NextRequest('http://localhost/api/telegram', {
      method: 'POST',
      body: JSON.stringify({ message: { text: 'hello' } }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized')
  })

  it('should return 401 if secret query parameter is invalid', async () => {
    const request = new NextRequest('http://localhost/api/telegram?secret=wrong_token', {
      method: 'POST',
      body: JSON.stringify({ message: { text: 'hello' } }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 if JSON payload is invalid', async () => {
    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: 'invalid-json',
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Invalid JSON payload')
  })

  it('should return 400 if payload is not an object', async () => {
    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: JSON.stringify('not-an-object'),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Payload must be an object')
  })

  it('should process payload and assign user_id if profile is found by chat_id', async () => {
    // Setup profile query to find a user
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-uuid-123' },
      error: null,
    })

    const payload = {
      update_id: 1,
      message: {
        message_id: 101,
        chat: { id: 999 },
        from: { username: 'testuser' },
        text: 'hello bot',
      },
    }

    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.ok).toBe(true)

    // Assert database was queried by chat_id
    expect(mockEq).toHaveBeenCalledWith('telegram_chat_id', 999)
    // Assert user_id was stored properly in inputs table
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-uuid-123',
      payload,
      processed: false,
    })
  })

  it('should process payload, assign user_id and update chat_id if profile is found by username', async () => {
    // 1st call for chat_id -> returns null
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    // 2nd call for username -> returns profile
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-uuid-456' },
      error: null,
    })

    const payload = {
      update_id: 2,
      message: {
        message_id: 102,
        chat: { id: 888 },
        from: { username: 'user_without_chat_id_yet' },
        text: 'hello bot username',
      },
    }

    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Verify it updated the telegram_chat_id in profiles
    expect(mockUpdate).toHaveBeenCalledWith({ telegram_chat_id: 888 })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-uuid-456')

    // Verify input was inserted with resolved user_id
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-uuid-456',
      payload,
      processed: false,
    })
  })

  it('should insert input with user_id: null if no profile matches', async () => {
    // 1st call for chat_id -> returns null
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    // 2nd call for username -> returns null
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    const payload = {
      update_id: 3,
      message: {
        message_id: 103,
        chat: { id: 777 },
        from: { username: 'unknown_user' },
        text: 'hello unknown',
      },
    }

    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Verify input was inserted with user_id: null
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: null,
      payload,
      processed: false,
    })
  })

  it('should return 500 if database insertion fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockThrowOnError.mockRejectedValueOnce(new Error('Database insertion failed'))

    const payload = { message: { text: 'fail-insert' } }
    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error).toBe('Internal Server Error')
  })

  // ─── Δ1: loopback guard ────────────────────────────────────────────────────
  it('loopback host accepted: Host: 127.0.0.1:3000 → 200', async () => {
    const payload = { message: { text: 'loopback-ok' } }
    const request = new NextRequest('http://127.0.0.1:3000/api/telegram?secret=test_token', {
      method: 'POST',
      headers: { host: '127.0.0.1:3000' },
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it('remote host rejected: Host: evil.example.com → 403 (regardless of secret)', async () => {
    const payload = { message: { text: 'remote-attack' } }
    const request = new NextRequest('http://evil.example.com/api/telegram?secret=test_token', {
      method: 'POST',
      headers: { host: 'evil.example.com' },
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
