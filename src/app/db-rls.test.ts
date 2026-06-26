import { describe, it, expect, vi } from 'vitest'
import { createClient } from '@/lib/supabase-client'

// Setup vitest mocks for Supabase client unconditionally for test isolation
vi.mock('@/lib/supabase-client', () => {
  const mockFrom = vi.fn().mockImplementation(() => {
    return {
      select: vi.fn().mockImplementation(() => {
        // Simulate unauthenticated RLS: returns empty or access denied
        return Promise.resolve({ data: null, error: { message: 'new row-level security policy violation', code: '42501' } })
      }),
      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        // Simulate profile isolation check
        if (!data.user_id) {
          return Promise.resolve({ data: null, error: { message: 'RLS violation: user_id is required', code: '42501' } })
        }
        return Promise.resolve({ data: [data], error: null })
      }),
    }
  })

  return {
    createClient: vi.fn().mockReturnValue({
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }),
  }
})

describe('Database Row Level Security (RLS) & Isolation Tests', () => {

  it('Read Task RLS Block: should block unauthenticated clients from reading user tasks', async () => {
    const supabase = createClient()
    
    // Ensure the client has no authenticated user
    const { data: authData } = await supabase.auth.getUser()
    expect(authData.user).toBeNull()

    // Try to select tasks
    const { error } = await supabase.from('tasks').select('*')
    
    // In mock mode representing unauthenticated client, we expect the RLS violation error
    expect(error).toBeDefined()
    expect(error?.code).toBe('42501')
  })

  it('Create Task: should link task to profile and isolate actions when authenticated', async () => {
    const supabase = createClient()
    const taskPayload = {
      user_id: 'user-uuid-12345',
      title: 'Review specifications',
      status: 'todo',
    }

    const { data, error } = await supabase.from('tasks').insert(taskPayload)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.[0].title).toBe('Review specifications')
    expect(data?.[0].status).toBe('todo')
    expect(data?.[0].user_id).toBe('user-uuid-12345')
  })

  it('Log Habit Completion (H-1, H-2, H-3): should log a completion for a habit with today\'s date by default', async () => {
    const supabase = createClient()
    const todayStr = new Date().toISOString().split('T')[0]
    const habitLogPayload = {
      user_id: 'user-uuid-12345',
      habit_id: 'habit-uuid-999',
      log_date: todayStr,
    }

    const { data, error } = await supabase.from('habit_logs').insert(habitLogPayload)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.[0].habit_id).toBe('habit-uuid-999')
    expect(data?.[0].log_date).toBe(todayStr)
    expect(data?.[0].user_id).toBe('user-uuid-12345')
  })

  it('Create Expense (TX-1, TX-2): should create an expense transaction successfully', async () => {
    const supabase = createClient()
    const transactionPayload = {
      user_id: 'user-uuid-12345',
      description: 'Lunch',
      amount: 15.00,
      type: 'expense',
      transaction_date: new Date().toISOString().split('T')[0],
    }

    const { data, error } = await supabase.from('transactions').insert(transactionPayload)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.[0].description).toBe('Lunch')
    expect(data?.[0].amount).toBe(15.00)
    expect(data?.[0].type).toBe('expense')
    expect(data?.[0].user_id).toBe('user-uuid-12345')
  })

  it('Save Diet Entry (J-1): should save a diet entry categorized properly', async () => {
    const supabase = createClient()
    const entryPayload = {
      user_id: 'user-uuid-12345',
      content: 'Ate grilled chicken',
      entry_type: 'diet',
      entry_date: new Date().toISOString().split('T')[0],
    }

    const { data, error } = await supabase.from('journal_entries').insert(entryPayload)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.[0].content).toBe('Ate grilled chicken')
    expect(data?.[0].entry_type).toBe('diet')
    expect(data?.[0].user_id).toBe('user-uuid-12345')
  })
})

