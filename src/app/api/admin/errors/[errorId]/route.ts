// ============================================
// DELETE /api/admin/errors/[errorId] — Delete error entry
// Phase 9: Remove error log entry with audit log
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function DELETE(
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

    await db.errorLog.delete({ where: { id: errorId } })

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action: 'delete_error',
      target_type: 'error',
      target_id: errorId,
      details: { errorMessage: errorLog.message, errorType: errorLog.type, count: errorLog.count },
    })

    return NextResponse.json({ ok: true, data: { errorId, deleted: true } })
  } catch (err) {
    console.error('Admin delete error error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
