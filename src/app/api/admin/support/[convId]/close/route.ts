// ============================================
// POST /api/admin/support/[convId]/close — Admin closes conversation
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ convId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { convId } = await params
    if (!convId) {
      return NextResponse.json({ ok: false, error: 'Missing conversation ID' }, { status: 400 })
    }

    const conversation = await db.supportConversation.findUnique({
      where: { id: convId },
    })

    if (!conversation) {
      return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 })
    }

    await db.supportConversation.update({
      where: { id: convId },
      data: { status: 'closed' },
    })

    // Log admin action
    await logAdminAction({
      admin_id: admin.id,
      action: 'support_close_conversation',
      target_type: 'support_conversation',
      target_id: convId,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin support close error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
