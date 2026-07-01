import {
  type MockDatabase,
  type MockFilterClause,
  type MockOrderClause,
  type MockPostgrestError,
  type MockQueryResult,
  type MockSupabaseClient,
  type QueryAction,
} from './sqlite-db'

/**
 * Mock Supabase client for use in Browser / Client Components.
 *
 * Pure in-memory mock — all queries resolve to `{ data: null, error: null }`.
 * No network calls. The previous version fetched `/api/sqlite`, a route
 * that was never created (verified dead in the 2026-06-27 SDD cycle,
 * `openspec/changes/archive/2026-06-27-mvp-vida-core/design.md:533`).
 *
 * The `thenable` interface is preserved so existing component code
 * (`const { data, error } = await supabase.from(...).select(...)`)
 * continues to compile and run; components that depend on real data
 * (e.g. `HabitList`, `Dashboard`) get `data: null` and render their
 * empty state. Real data flows through the server-side bridge
 * (`src/lib/supabase.ts`) used by API routes.
 */
class MockQueryChain<Row, Result = Row[] | null> {
  table: string
  action: QueryAction = 'select'
  args: Record<string, unknown> | null = null
  filters: MockFilterClause[] = []
  orderBy: MockOrderClause | null = null
  singleRow: boolean = false
  maybeSingleRow: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select(): MockQueryChain<Row, Result> {
    this.action = 'select'
    return this
  }

  insert(values: Record<string, unknown>): MockQueryChain<Row, Row[]> {
    this.action = 'insert'
    this.args = values
    return this as unknown as MockQueryChain<Row, Row[]>
  }

  update(values: Record<string, unknown>): MockQueryChain<Row, Row[]> {
    this.action = 'update'
    this.args = values
    return this as unknown as MockQueryChain<Row, Row[]>
  }

  delete(): MockQueryChain<Row, Row[]> {
    this.action = 'delete'
    return this as unknown as MockQueryChain<Row, Row[]>
  }

  eq(column: string, value: unknown): MockQueryChain<Row, Result> {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  order(column: string, options?: { ascending: boolean }): MockQueryChain<Row, Result> {
    this.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  limit(_rows: number): MockQueryChain<Row, Result> {
    return this
  }

  gte(_column: string, _value: unknown): MockQueryChain<Row, Result> {
    return this
  }

  gt(_column: string, _value: unknown): MockQueryChain<Row, Result> {
    return this
  }

  single(): MockQueryChain<Row, Row | null> {
    this.singleRow = true
    return this as unknown as MockQueryChain<Row, Row | null>
  }

  maybeSingle(): MockQueryChain<Row, Row | null> {
    this.maybeSingleRow = true
    return this as unknown as MockQueryChain<Row, Row | null>
  }

  throwOnError(): MockQueryChain<Row, Result> {
    // No-op: the browser mock never throws. The chain's `then` resolves
    // directly to `{ data: null, error: null }`. Exposed for type
    // compatibility with the real supabase-js chain signature only.
    return this
  }

  // Thenable interface to await the query chain directly.
  // Pure mock: resolves to { data: null, error: null }.
  then<TResult1 = MockQueryResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: MockQueryResult<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return (async () => {
      const payload: MockQueryResult<Result> = { data: null as Result, error: null }
      return onfulfilled
        ? await Promise.resolve(onfulfilled(payload))
        : (payload as unknown as TResult1)
    })()
  }
}

class MockBrowserClient implements MockSupabaseClient<MockDatabase> {
  auth = {
    getUser: async () => ({
      data: {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'user@pesos.local'
        }
      },
      error: null as MockPostgrestError | null
    }),
    signOut: async () => ({ error: null as MockPostgrestError | null }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: { message: 'Sign up is not implemented in the offline mock', code: 'NOT_IMPLEMENTED' } as MockPostgrestError
    }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: { message: 'Sign in is not implemented in the offline mock', code: 'NOT_IMPLEMENTED' } as MockPostgrestError
    }),
  }

  from<TableName extends keyof MockDatabase['public']['Tables'] & string>(
    table: TableName
  ): MockQueryChain<MockDatabase['public']['Tables'][TableName]['Row']> {
    return new MockQueryChain<MockDatabase['public']['Tables'][TableName]['Row']>(table)
  }

  rpc(_name: string, _args?: Record<string, unknown>): Promise<MockQueryResult<unknown>> {
    // Pure mock: resolve to { data: null, error: null }.
    return Promise.resolve({ data: null, error: null })
  }
}

export function createClient(): MockSupabaseClient<MockDatabase> {
  return new MockBrowserClient()
}
