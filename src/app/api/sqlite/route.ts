import { NextRequest, NextResponse } from 'next/server'
import '@/lib/env-loader'
import { verifySession } from '@/lib/auth-gate'
import { runSQLiteQuery, type MockQuery } from '@/lib/sqlite-db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get('session')?.value
    if (!cookie || !verifySession(cookie)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = (await request.json()) as MockQuery
    const result = runSQLiteQuery(query)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('API /api/sqlite error:', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json(
      {
        data: null,
        error: {
          message: msg,
          code: 'INTERNAL_ERROR',
        },
      },
      { status: 500 }
    )
  }
}
