import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/chat/[chatId]/messages — Get messages for a specific chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { chatId } = await params
    if (!chatId) {
      return NextResponse.json({ ok: false, error: "chatId is required" }, { status: 400 })
    }

    // Verify user is a participant of this chat
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, user1_id: true, user2_id: true },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant of this chat" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limit = 50
    const now = new Date()

    // Fetch messages (newest first for cursor-based pagination)
    // We fetch raw and filter in code because Prisma + SQLite doesn't handle
    // OR + nullable date comparisons well in a single query
    const messages = await db.message.findMany({
      where: {
        chat_id: chatId,
        is_unsent: false,
        ...(cursor ? { sent_at: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { sent_at: "desc" },
      take: limit + 1,
      select: {
        id: true,
        sender_id: true,
        content: true,
        media_url: true,
        media_type: true,
        is_view_once: true,
        view_once_duration: true,
        is_ghost_deleted: true,
        ghost_deleted_by: true,
        viewed: true,
        viewed_at: true,
        reply_to_id: true,
        delivered: true,
        delivered_at: true,
        sent_at: true,
        auto_delete_at: true,
        hard_delete_at: true,
      },
    })

    // Filter in code for complex conditions:
    // 1. Ghost delete: hide if ghost-deleted AND sent by me (I ghost-deleted my own messages)
    // 2. Auto-delete: hide if auto_delete_at has passed
    // 3. Hard delete: hide if hard_delete_at has passed
    const filtered = messages.filter((m) => {
      // Ghost delete filter — ghost delete means "delete for me", so hide from the deleter
      // Since ghost delete is available for own messages, the sender ghost-deleted it = hide from sender
      if (m.is_ghost_deleted && m.ghost_deleted_by === user.id) return false
      // Auto-delete filter (null = no auto-delete timer)
      if (m.auto_delete_at && m.auto_delete_at <= now) return false
      // Hard delete filter (null = no hard delete timer)
      if (m.hard_delete_at && m.hard_delete_at <= now) return false
      return true
    })

    const hasNextPage = filtered.length > limit
    const paginated = hasNextPage ? filtered.slice(0, limit) : filtered
    const nextCursor = hasNextPage
      ? paginated[paginated.length - 1].sent_at.toISOString()
      : null

    // NOTE: Messages are NO LONGER marked as viewed on GET.
    // Marking as read is now handled by a separate PUT /api/chat/[chatId]/mark-read endpoint,
    // called from the frontend after a delay (1.5s) or on scroll — not instantly on open.

    // Format response (reverse to chronological order for display)
    const data = paginated.reverse().map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      content: m.content,
      media_url: m.media_url,
      media_type: m.media_type,
      is_view_once: m.is_view_once,
      view_once_duration: m.view_once_duration,
      viewed: m.viewed,
      reply_to_id: m.reply_to_id,
      delivered: m.delivered,
      sent_at: m.sent_at,
    }))

    return NextResponse.json({ ok: true, data, nextCursor })
  } catch (error) {
    console.error("Chat messages error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get messages" }, { status: 500 })
  }
}
