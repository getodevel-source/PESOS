import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => {
  const mockMaybeSingle = vi.fn()
  const mockEq = vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  }))
  const mockSelect = vi.fn(() => ({
    eq: mockEq,
  }))
  const mockInsert = vi.fn()
  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = vi.fn(() => ({
    eq: mockUpdateEq,
  }))

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
      return {} as Record<string, unknown>
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
      mockSelect,
      mockEq,
      mockMaybeSingle,
      mockUpdate,
      mockUpdateEq,
    },
  }
})

interface MockedSupabaseModule {
  _mocks: {
    mockInsert: ReturnType<typeof vi.fn>
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
  mockEq,
  mockMaybeSingle,
  mockUpdate,
  mockUpdateEq,
} = supabaseMock._mocks

describe('Telegram Webhook Route Handler', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
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

    mockInsert.mockResolvedValueOnce({ error: null })

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

    mockInsert.mockResolvedValueOnce({ error: null })

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

    mockInsert.mockResolvedValueOnce({ error: null })

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
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB Error' } })

    const payload = { message: { text: 'fail-insert' } }
    const request = new NextRequest('http://localhost/api/telegram?secret=test_token', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error).toBe('Database insertion failed')
  })
})
