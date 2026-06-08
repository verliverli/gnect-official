// ============================================
// GET /api/admin/errors — Error monitor list (admin only)
// Phase 9: View all errors sorted by frequency
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const isResolved = searchParams.get('is_resolved')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }
    if (isResolved === 'true') {
      where.is_resolved = true
    } else if (isResolved === 'false') {
      where.is_resolved = false
    }

    const [errors, total] = await Promise.all([
      db.errorLog.findMany({
        where,
        orderBy: { count: 'desc' },
        skip,
        take: limit,
      }),
      db.errorLog.count({ where }),
    ])

    // Get distinct user count for each error
    // Since ErrorLog only stores one user_id at a time, we can't easily get distinct users
    // from the schema alone. We'll just return the stored data.
    const data = errors.map((e) => ({
      id: e.id,
      message: e.message,
      type: e.type,
      screen: e.screen,
      stack_trace: e.stack_trace,
      count: e.count,
      first_seen_at: e.first_seen_at,
      last_seen_at: e.last_seen_at,
      is_resolved: e.is_resolved,
      user_id: e.user_id,
    }))

    return NextResponse.json({
      ok: true,
      data: {
        errors: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err) {
    console.error('Admin errors list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
