import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/group/[roomId]/messages — Get messages for a group room
// - Auth required + verify membership
// - Returns last 50 messages, ordered by sent_at ASC
// - Supports ?before=<messageId> cursor for loading older messages
// - Updates member's last_read_at
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { roomId } = await params
    if (!roomId) {
      return NextResponse.json({ ok: false, error: "roomId is required" }, { status: 400 })
    }

    // ===== 1. Verify user is a member of the room =====
    const membership = await db.groupMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      select: { id: true },
    })

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "You are not a member of this room" },
        { status: 403 }
      )
    }

    // ===== 2. Parse cursor for pagination =====
    const { searchParams } = new URL(request.url)
    const beforeId = searchParams.get("before") // messageId cursor
    const limit = 50

    // If a cursor is provided, find the sent_at of that message to use as offset
    let cursorTime: Date | null = null
    if (beforeId) {
      const cursorMsg = await db.groupMessage.findUnique({
        where: { id: beforeId },
        select: { sent_at: true, room_id: true },
      })
      if (cursorMsg && cursorMsg.room_id === roomId) {
        cursorTime = cursorMsg.sent_at
      }
    }

    // ===== 3. Fetch messages (newest first for cursor, then reverse) =====
    const messages = await db.groupMessage.findMany({
      where: {
        room_id: roomId,
        is_unsent: false,
        ...(cursorTime ? { sent_at: { lt: cursorTime } } : {}),
      },
      orderBy: { sent_at: "desc" },
      take: limit + 1, // +1 to detect next page
      select: {
        id: true,
        sender_id: true,
        anonymous_name: true,
        content: true,
        media_url: true,
        media_type: true,
        reply_to_id: true,
        sent_at: true,
        hard_delete_at: true,
      },
    })

    // Filter out messages past their hard_delete_at (safety net, cron should catch most)
    const now = new Date()
    const filtered = messages.filter((m) => !m.hard_delete_at || m.hard_delete_at > now)

    const hasNextPage = filtered.length > limit
    const paginated = hasNextPage ? filtered.slice(0, limit) : filtered
    const nextCursor = hasNextPage ? paginated[paginated.length - 1].id : null

    // Reverse to chronological order for display
    const data = paginated.reverse().map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      anonymous_name: m.anonymous_name,
      content: m.content,
      media_url: m.media_url,
      media_type: m.media_type,
      reply_to_id: m.reply_to_id,
      sent_at: m.sent_at,
    }))

    // ===== 4. Update member's last_read_at =====
    await db.groupMember.update({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      data: { last_read_at: now },
    })

    return NextResponse.json({ ok: true, data, nextCursor })
  } catch (error) {
    console.error("Group messages error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get messages" }, { status: 500 })
  }
}
