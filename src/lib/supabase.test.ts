import { describe, it, expect, vi, beforeEach } from 'vitest'

// The browser supabase client (src/lib/supabase-client.ts) is a pure
// in-memory mock: every chain resolves to { data: null, error: null }
// regardless of the chain shape. These tests pin that contract so
// future refactors don't accidentally introduce a network call or
// a real SQLite hit (those are separate concerns handled by the
// server-side bridge at src/lib/supabase.ts).

import { createClient } from './supabase-client'

describe('supabase-client mock — chainable thenable interface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({ data: null, error: null }),
          text: async () => '',
        }
      })
    )
  })

  it('a select().eq().order() chain resolves to { data: null, error: null }', async () => {
    const supabase = createClient()
    const result = await supabase
      .from('habits')
      .select('id, title')
      .eq('user_id', 'u-1')
      .order('created_at', { ascending: false })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('a single() call still resolves to a thenable', async () => {
    const supabase = createClient()
    const result = await supabase.from('habits').select('id').eq('id', 'h-1').single()
    expect(result).toHaveProperty('data')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('a maybeSingle() call still resolves to a thenable', async () => {
    const supabase = createClient()
    const result = await supabase.from('habits').select('id').maybeSingle()
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('an insert() chain resolves without throwing', async () => {
    const supabase = createClient()
    const result = await supabase
      .from('habits')
      .insert({ id: 'h-1', title: 'Test', user_id: 'u-1' })
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('a throwOnError() is a no-op and returns the chain', () => {
    const supabase = createClient()
    const chain = supabase.from('habits').select('id')
    expect(typeof chain.throwOnError).toBe('function')
    expect(() => chain.throwOnError()).not.toThrow()
    expect(chain.throwOnError()).toBe(chain)
  })

  it('an update() chain resolves without throwing', async () => {
    const supabase = createClient()
    const result = await supabase.from('habits').update({ title: 'New' }).eq('id', 'h-1')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('a delete() chain resolves without throwing', async () => {
    const supabase = createClient()
    const result = await supabase.from('habits').delete().eq('id', 'h-1')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('rpc(name) resolves to { data: null, error: null }', async () => {
    const supabase = createClient()
    const result = await supabase.rpc('check_and_unlock_achievements', { target_user_id: 'u-1' })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('serializes queries as MockQuery and POSTs to /api/sqlite', async () => {
    const supabase = createClient()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'h-1', title: 'Habit 1' }], error: null }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await supabase
      .from('habits')
      .select('id, title')
      .eq('user_id', 'u-1')
      .order('created_at', { ascending: false })
      .maybeSingle()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/sqlite')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      table: 'habits',
      action: 'select',
      args: null,
      filters: [{ type: 'eq', column: 'user_id', value: 'u-1' }],
      order: { column: 'created_at', ascending: false },
      single: false,
      maybeSingle: true,
    })
    expect(result.data).toEqual([{ id: 'h-1', title: 'Habit 1' }])
    expect(result.error).toBeNull()
  })

  it('serializes RPC calls and POSTs to /api/sqlite', async () => {
    const supabase = createClient()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { success: true }, error: null }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await supabase.rpc('my_custom_rpc', { arg1: 'val1' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/sqlite')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      action: 'select',
      args: null,
      filters: [],
      order: null,
      single: false,
      maybeSingle: false,
      rpcName: 'my_custom_rpc',
      rpcArgs: { arg1: 'val1' },
    })
    expect(result.data).toEqual({ success: true })
    expect(result.error).toBeNull()
  })
})

describe('supabase-client mock — client surface', () => {
  it('createClient returns a client with from() and rpc()', () => {
    const supabase = createClient()
    expect(supabase).toHaveProperty('from')
    expect(supabase).toHaveProperty('rpc')
    expect(typeof supabase.from).toBe('function')
    expect(typeof supabase.rpc).toBe('function')
  })
})
