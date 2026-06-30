import {
  runSQLiteQuery,
  MOCK_USER_ID,
  MOCK_USER_EMAIL,
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
 * Server-side mock query chain that maps calls directly to SQLite.
 *
 * Generic over `Result` so `.single()` / `.maybeSingle()` narrow the awaited
 * data to `Row | null` while a plain select chain keeps `Row[] | null`.
 */
class ServerMockQueryChain<Row, Result = Row[] | null> {
  table: string
  action: QueryAction = 'select'
  args: Record<string, unknown> | null = null
  filters: MockFilterClause[] = []
  orderBy: MockOrderClause | null = null
  singleRow: boolean = false
  maybeSingleRow: boolean = false

  shouldThrow: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select(): ServerMockQueryChain<Row, Result> {
    this.action = 'select'
    return this
  }

  insert(values: Record<string, unknown>): ServerMockQueryChain<Row, Row[]> {
    this.action = 'insert'
    this.args = values
    return this as unknown as ServerMockQueryChain<Row, Row[]>
  }

  update(values: Record<string, unknown>): ServerMockQueryChain<Row, Row[]> {
    this.action = 'update'
    this.args = values
    return this as unknown as ServerMockQueryChain<Row, Row[]>
  }

  delete(): ServerMockQueryChain<Row, Row[]> {
    this.action = 'delete'
    return this as unknown as ServerMockQueryChain<Row, Row[]>
  }

  eq(column: string, value: unknown): ServerMockQueryChain<Row, Result> {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  order(column: string, options?: { ascending: boolean }): ServerMockQueryChain<Row, Result> {
    this.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  limit(_rows: number): ServerMockQueryChain<Row, Result> {
    // The mock does not actually slice results — it is a no-op that exists
    // so call sites that compose `.limit(n)` keep type-checking. The SQLite
    // runner ignores the limit and returns all matching rows.
    return this
  }

  gte(_column: string, _value: unknown): ServerMockQueryChain<Row, Result> {
    // The mock only implements the `eq` filter today; the greater-than-or-
    // equal operator is a no-op so call sites type-check.
    return this
  }

  gt(_column: string, _value: unknown): ServerMockQueryChain<Row, Result> {
    // Same as `gte` — accepted for type compatibility, ignored at runtime.
    return this
  }

  single(): ServerMockQueryChain<Row, Row | null> {
    this.singleRow = true
    return this as unknown as ServerMockQueryChain<Row, Row | null>
  }

  maybeSingle(): ServerMockQueryChain<Row, Row | null> {
    this.maybeSingleRow = true
    return this as unknown as ServerMockQueryChain<Row, Row | null>
  }

  throwOnError(): ServerMockQueryChain<Row, Result> {
    this.shouldThrow = true
    return this
  }

  then<TResult1 = MockQueryResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: MockQueryResult<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return (async () => {
      try {
        const res = runSQLiteQuery({
          table: this.table,
          action: this.action,
          args: this.args,
          filters: this.filters,
          order: this.orderBy,
          single: this.singleRow,
          maybeSingle: this.maybeSingleRow
        })
        if (this.shouldThrow && res.error) {
          // res.error is a string per the internal result type; we only enter
          // this branch when it is truthy, so it is a string here.
          throw new Error(res.error)
        }
        // Cast the internal `{ data: unknown; error: string | null }` to the
        // public result shape. The runtime is unchanged — existing call sites
        // already access `.message` / `.code` on the error and handle a
        // missing `code` by getting `undefined`.
        const publicRes: MockQueryResult<Result> = {
          data: res.data as Result,
          error: res.error ? { message: res.error, code: 'SQLITE_ERROR' } : null
        }
        return onfulfilled ? await Promise.resolve(onfulfilled(publicRes)) : (publicRes as unknown as TResult1)
      } catch (err) {
        if (onrejected) {
          return await Promise.resolve(onrejected(err))
        }
        throw err
      }
    })()
  }
}

class ServerMockSupabaseClient implements MockSupabaseClient<MockDatabase> {
  auth = {
    getUser: async () => ({
      data: {
        user: {
          id: MOCK_USER_ID,
          email: MOCK_USER_EMAIL
        }
      },
      error: null as MockPostgrestError | null
    }),
    signOut: async () => ({ error: null as MockPostgrestError | null }),
    // The auth API used by `AuthForm.tsx`. The offline mock does not
    // actually create users or sessions — it always reports an
    // "not implemented" error so the form can show a friendly message.
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
  ): ServerMockQueryChain<MockDatabase['public']['Tables'][TableName]['Row']> {
    return new ServerMockQueryChain<MockDatabase['public']['Tables'][TableName]['Row']>(table)
  }

  rpc(name: string, args?: Record<string, unknown>): Promise<MockQueryResult<unknown>> {
    return Promise.resolve(
      runSQLiteQuery({ rpcName: name, rpcArgs: args } satisfies Partial<MockQuery> as MockQuery) as unknown as MockQueryResult<unknown>
    )
  }
}

export async function createServerClientInstance(): Promise<MockSupabaseClient<MockDatabase>> {
  return new ServerMockSupabaseClient()
}

export function createAdminClient(): MockSupabaseClient<MockDatabase> {
  return new ServerMockSupabaseClient()
}
