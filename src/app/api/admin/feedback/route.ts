// ============================================
// GET /api/admin/feedback — Feedback list grouped by region (admin only)
// Phase 9: View all feedback with filtering and sorting
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
    const status = searchParams.get('status') || undefined
    const region = searchParams.get('region') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }
    if (status) {
      where.status = status
    }
    if (region) {
      where.region = region
    }

    const [feedbacks, total] = await Promise.all([
      db.feedback.findMany({
        where,
        include: {
          user: { select: { nickname: true } },
        },
        orderBy: [
          { is_pinned: 'desc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
      }),
      db.feedback.count({ where }),
    ])

    const data = feedbacks.map((f) => ({
      id: f.id,
      type: f.type,
      content: f.content,
      region: f.region,
      status: f.status,
      is_pinned: f.is_pinned,
      admin_notes: f.admin_notes,
      created_at: f.created_at,
      userNickname: f.user.nickname,
    }))

    return NextResponse.json({
      ok: true,
      data: {
        feedbacks: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err) {
    console.error('Admin feedback list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
