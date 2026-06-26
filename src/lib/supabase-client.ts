/**
 * Mock Supabase client for use in Browser / Client Components.
 * Redirects all queries to Next.js local SQLite API route.
 */
class MockQueryChain {
  table: string
  action: string = 'select'
  args: any = null
  filters: any[] = []
  orderBy: any = null
  singleRow: boolean = false
  maybeSingleRow: boolean = false

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

  // Thenable interface to await the query chain directly
  async then(resolve: (value: any) => void) {
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
      const payload = await res.json()
      resolve(payload)
    } catch (err) {
      resolve({ data: null, error: err instanceof Error ? err.message : String(err) })
    }
  }
}

class MockSupabaseClient {
  auth = {
    getUser: async () => ({
      data: {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'user@pesos.local'
        }
      },
      error: null
    }),
    signOut: async () => ({ error: null }),
  }

  from(table: string) {
    return new MockQueryChain(table)
  }

  rpc(name: string, args?: any) {
    return {
      then: async (resolve: (value: any) => void) => {
        try {
          const res = await fetch('/api/sqlite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rpcName: name, rpcArgs: args })
          })
          const payload = await res.json()
          resolve(payload)
        } catch (err) {
          resolve({ data: null, error: err instanceof Error ? err.message : String(err) })
        }
      }
    }
  }
}

export function createClient() {
  return new MockSupabaseClient() as any
}
