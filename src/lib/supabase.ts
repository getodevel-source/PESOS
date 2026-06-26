import { runSQLiteQuery, MOCK_USER_ID, MOCK_USER_EMAIL } from './sqlite-db'

/**
 * Server-side mock query chain that maps calls directly to SQLite.
 */
class ServerMockQueryChain {
  table: string
  action: string = 'select'
  args: any = null
  filters: any[] = []
  orderBy: any = null
  singleRow: boolean = false
  maybeSingleRow: boolean = false

  shouldThrow: boolean = false

  constructor(table: string) {
    this.table = table
  }

  select() {
    this.action = 'select'
    return this
  }

  insert(values: any) {
    this.action = 'insert'
    this.args = values
    return this
  }

  update(values: any) {
    this.action = 'update'
    this.args = values
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  order(column: string, options?: { ascending: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  single() {
    this.singleRow = true
    return this
  }

  maybeSingle() {
    this.maybeSingleRow = true
    return this
  }

  throwOnError() {
    this.shouldThrow = true
    return this
  }

  async then(resolve: (value: any) => void, reject?: (reason: any) => void) {
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
        throw new Error(typeof res.error === 'string' ? res.error : (res.error as any)?.message || String(res.error))
      }
      resolve(res)
    } catch (err) {
      if (reject) reject(err)
      else throw err
    }
  }
}

class ServerMockSupabaseClient {
  auth = {
    getUser: async () => ({
      data: {
        user: {
          id: MOCK_USER_ID,
          email: MOCK_USER_EMAIL
        }
      },
      error: null
    }),
    signOut: async () => ({ error: null }),
  }

  from(table: string) {
    return new ServerMockQueryChain(table)
  }

  rpc(name: string, args?: any) {
    return {
      then: async (resolve: (value: any) => void) => {
        const res = runSQLiteQuery({ rpcName: name, rpcArgs: args })
        resolve(res)
      }
    }
  }
}

export async function createServerClientInstance() {
  return new ServerMockSupabaseClient() as any
}

export function createAdminClient() {
  return new ServerMockSupabaseClient() as any
}
