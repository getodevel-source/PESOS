import {
  type MockDatabase,
  type MockFilterClause,
  type MockOrderClause,
  type MockPostgrestError,
  type MockQuery,
  type MockQueryResult,
  type MockSupabaseClient,
  type QueryAction,
} from './sqlite-db'

/**
 * Mock Supabase client for use in Browser / Client Components.
 * Redirects all queries to Next.js local SQLite API route.
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
    // No-op: the browser mock cannot throw because the `/api/sqlite`
    // response is parsed and its `error` field surfaced through the
    // `MockQueryResult` shape. Exposed for type compatibility only.
    return this
  }

  // Thenable interface to await the query chain directly
  then<TResult1 = MockQueryResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: MockQueryResult<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return (async () => {
      try {
        const res = await fetch('/api/sqlite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: this.table,
            action: this.action,
            args: this.args,
            filters: this.filters,
            order: this.orderBy,
            single: this.singleRow,
            maybeSingle: this.maybeSingleRow
          })
        })
        const payload = (await res.json()) as MockQueryResult<Result>
        return onfulfilled ? await Promise.resolve(onfulfilled(payload)) : (payload as unknown as TResult1)
      } catch (err) {
        const errPayload: MockQueryResult<Result> = {
          data: null as Result,
          error: { message: err instanceof Error ? err.message : String(err), code: 'SQLITE_ERROR' }
        }
        if (onrejected) {
          return await Promise.resolve(onrejected(err))
        }
        return errPayload as unknown as TResult1
      }
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

  rpc(name: string, args?: Record<string, unknown>): Promise<MockQueryResult<unknown>> {
    return (async () => {
      try {
        const res = await fetch('/api/sqlite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rpcName: name, rpcArgs: args } satisfies Partial<MockQuery>)
        })
        const payload = (await res.json()) as MockQueryResult<unknown>
        return payload
      } catch (err) {
        return {
          data: null,
          error: { message: err instanceof Error ? err.message : String(err), code: 'SQLITE_ERROR' }
        }
      }
    })()
  }
}

export function createClient(): MockSupabaseClient<MockDatabase> {
  return new MockBrowserClient()
}
