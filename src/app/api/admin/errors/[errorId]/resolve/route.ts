// ============================================
// POST /api/admin/errors/[errorId]/resolve — Resolve error
// Phase 9: Mark error as resolved with audit log
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ errorId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { errorId } = await params
    if (!errorId) {
      return NextResponse.json({ ok: false, error: 'Missing errorId' }, { status: 400 })
    }

    // Check error exists
    const errorLog = await db.errorLog.findUnique({ where: { id: errorId } })
    if (!errorLog) {
      return NextResponse.json({ ok: false, error: 'Error not found' }, { status: 404 })
    }

    await db.errorLog.update({
      where: { id: errorId },
      data: {
        is_resolved: true,
        resolved_by: admin.id,
        resolved_at: new Date(),
      },
    })

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action: 'resolve_error',
      target_type: 'error',
      target_id: errorId,
      details: { errorMessage: errorLog.message, errorType: errorLog.type },
    })

    return NextResponse.json({ ok: true, data: { errorId, is_resolved: true } })
  } catch (err) {
    console.error('Admin resolve error error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
