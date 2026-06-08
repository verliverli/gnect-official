// ============================================
// GET /api/admin/support/[convId] — Admin reads conversation messages
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ convId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { convId } = await params
    if (!convId) {
      return NextResponse.json({ ok: false, error: 'Missing conversation ID' }, { status: 400 })
    }

    const conversation = await db.supportConversation.findUnique({
      where: { id: convId },
      include: {
        user: {
          select: { id: true, nickname: true, region: true },
        },
        messages: {
          orderBy: { created_at: 'asc' },
          include: {
            sender: {
              select: { id: true, nickname: true, is_admin: true },
            },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: conversation })
  } catch (err) {
    console.error('Admin support read error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
