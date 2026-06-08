// ============================================
// GET /api/admin/community — Community moderation list (admin only)
// Phase 9: All posts including deleted, with report counts and author info
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const hasReports = searchParams.get('has_reports')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}

    if (search) {
      where.content = { contains: search }
    }
    if (category) {
      where.category = category
    }
    if (hasReports === 'true') {
      where.reports = { some: {} }
    }

    const [posts, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        include: {
          author: { select: { id: true, nickname: true } },
          _count: { select: { reports: true } },
        },
        orderBy: [
          { is_pinned: 'desc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
      }),
      db.communityPost.count({ where }),
    ])

    const data = posts.map((p) => ({
      id: p.id,
      content: p.content,
      category: p.category,
      region_tag: p.region_tag,
      upvotes_count: p.upvotes_count,
      comments_count: p.comments_count,
      is_deleted: p.is_deleted,
      is_pinned: p.is_pinned,
      created_at: p.created_at,
      authorId: p.author.id,
      authorNickname: p.author.nickname,
      reportCount: p._count.reports,
    }))

    return NextResponse.json({
      ok: true,
      data: {
        posts: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (err) {
    console.error('Admin community list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
