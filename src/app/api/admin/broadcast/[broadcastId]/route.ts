import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE /api/admin/broadcast/[broadcastId] — Delete a broadcast (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    if (!user.is_admin) return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })

    const { broadcastId } = await params
    if (!broadcastId) {
      return NextResponse.json({ ok: false, error: 'Missing broadcastId' }, { status: 400 })
    }

    // Delete associated notifications too — precise match to avoid fuzzy deletion
    await db.notification.deleteMany({
      where: { 
        type: 'admin_broadcast', 
        data: { contains: '"broadcastId":"' + broadcastId + '"' } 
      },
    })

    await db.adminBroadcast.delete({ where: { id: broadcastId } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete broadcast error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
