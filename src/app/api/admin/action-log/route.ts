// ============================================
// GET /api/admin/action-log — Audit trail (admin only)
// Phase 9: View all admin actions with admin nickname
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || undefined
    const target_type = searchParams.get('target_type') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (action) {
      where.action = action
    }
    if (target_type) {
      where.target_type = target_type
    }

    const [logs, total] = await Promise.all([
      db.adminActionLog.findMany({
        where,
        include: {
          admin: { select: { nickname: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      db.adminActionLog.count({ where }),
    ])

    const data = logs.map((l) => ({
      id: l.id,
      admin_id: l.admin_id,
      adminNickname: l.admin.nickname,
      action: l.action,
      target_type: l.target_type,
      target_id: l.target_id,
      details: l.details,
      created_at: l.created_at,
    }))

    return NextResponse.json({
      ok: true,
      data: {
        logs: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err) {
    console.error('Admin action log error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
