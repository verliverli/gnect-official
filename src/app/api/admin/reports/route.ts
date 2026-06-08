// ============================================
// GET /api/admin/reports — Unified report viewer (admin only)
// Phase 9: View user and post reports with filtering
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'user' // "user" | "post"
    const status = searchParams.get('status') || 'pending' // "pending" | "resolved"
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    if (type === 'user') {
      // User reports — pending = all reports (no status field to filter on, so "pending" = all exist)
      // "resolved" would be reports that were dismissed (deleted), but since dismissed = deleted,
      // we only ever show "pending" (existing) reports
      const where = {} // No status filter since Report model has no status field

      const [reports, total] = await Promise.all([
        db.report.findMany({
          where,
          include: {
            reporter: { select: { nickname: true } },
            reported: { select: { nickname: true } },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        db.report.count({ where }),
      ])

      const data = reports.map((r) => ({
        id: r.id,
        type: 'user' as const,
        reporterNickname: r.reporter.nickname,
        reportedNickname: r.reported.nickname,
        reason: r.reason,
        description: r.description,
        createdAt: r.created_at,
        status: 'pending' as const, // All existing reports are pending (dismissed = deleted)
      }))

      return NextResponse.json({
        ok: true,
        data: {
          reports: data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      })
    } else if (type === 'post') {
      // Post reports
      const where = {} // No status filter since PostReport model has no status field

      const [reports, total] = await Promise.all([
        db.postReport.findMany({
          where,
          include: {
            reporter: { select: { nickname: true } },
            post: {
              select: {
                id: true,
                content: true,
                is_deleted: true,
                author: { select: { nickname: true } },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        db.postReport.count({ where }),
      ])

      const data = reports.map((r) => ({
        id: r.id,
        type: 'post' as const,
        reporterNickname: r.reporter.nickname,
        postContent: r.post.content.slice(0, 200) + (r.post.content.length > 200 ? '...' : ''),
        postAuthorNickname: r.post.author.nickname,
        postIsDeleted: r.post.is_deleted,
        reason: r.reason,
        createdAt: r.created_at,
        status: 'pending' as const,
      }))

      return NextResponse.json({
        ok: true,
        data: {
          reports: data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      })
    } else {
      return NextResponse.json(
        { ok: false, error: 'type must be "user" or "post"' },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error('Admin reports list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
