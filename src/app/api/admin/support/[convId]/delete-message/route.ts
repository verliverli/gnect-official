// ============================================
// DELETE /api/admin/support/[convId]/delete-message — Admin deletes single message
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
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

    const body = await request.json()
    const { messageId } = body as { messageId?: string }

    if (!messageId) {
      return NextResponse.json({ ok: false, error: 'Missing messageId' }, { status: 400 })
    }

    // Verify message belongs to this conversation
    const message = await db.supportMessage.findUnique({
      where: { id: messageId },
    })

    if (!message || message.conversation_id !== convId) {
      return NextResponse.json({ ok: false, error: 'Message not found' }, { status: 404 })
    }

    await db.supportMessage.delete({
      where: { id: messageId },
    })

    // Log admin action
    await logAdminAction({
      admin_id: admin.id,
      action: 'support_delete_message',
      target_type: 'support_message',
      target_id: messageId,
      details: { conversation_id: convId },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin support delete message error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
