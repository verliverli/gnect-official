import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/chat/[chatId]/open — Combined endpoint for opening a chat
// Returns messages + self-destruct timer + rating + marks delivered in ONE call
// Replaces 4 separate API calls: messages, mark-delivered, self-destruct, ratings
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

    // Verify user is a participant and get chat info in one query
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        user1_id: true,
        user2_id: true,
        self_destruct_hours: true,
      },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant of this chat" }, { status: 403 })
    }

    // P1.6: Check block status (both directions) — blocked users cannot open chats
    const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id
    const blockRecord = await db.block.findFirst({
      where: {
        OR: [
          { blocker_id: user.id, blocked_id: otherUserId },
          { blocker_id: otherUserId, blocked_id: user.id },
        ],
      },
    })
    if (blockRecord) {
      return NextResponse.json({ ok: false, error: "Cannot open chat with blocked user" }, { status: 403 })
    }

    // Fire all independent queries in parallel for maximum speed
    const now = new Date()
    const messagesLimit = 50

    const [rawMessages, rating] = await Promise.all([
      // 1. Fetch messages
      db.message.findMany({
        where: {
          chat_id: chatId,
          is_unsent: false,
        },
        orderBy: { sent_at: "desc" },
        take: messagesLimit + 1,
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
      }),
      // 2. Get current user's rating for the other user
      db.userRating.findUnique({
        where: {
          rater_id_rated_user_id: { rater_id: user.id, rated_user_id: otherUserId },
        },
        select: { stars: true },
      }).catch(() => null),
    ])

    // 3. Mark undelivered messages as delivered (fire and forget — don't block response)
    db.message.updateMany({
      where: {
        chat_id: chatId,
        sender_id: { not: user.id },
        delivered: false,
        is_unsent: false,
      },
      data: { delivered: true, delivered_at: new Date() },
    }).catch(() => {}) // Silent — non-critical

    // Filter messages in code for complex conditions
    const filtered = rawMessages.filter((m) => {
      if (m.is_ghost_deleted && m.ghost_deleted_by === user.id) return false
      if (m.auto_delete_at && m.auto_delete_at <= now) return false
      if (m.hard_delete_at && m.hard_delete_at <= now) return false
      return true
    })

    const hasNextPage = filtered.length > messagesLimit
    const paginated = hasNextPage ? filtered.slice(0, messagesLimit) : filtered
    const nextCursor = hasNextPage
      ? paginated[paginated.length - 1].sent_at.toISOString()
      : null

    // Format messages (reverse to chronological order)
    const messages = paginated.reverse().map((m) => ({
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

    return NextResponse.json({
      ok: true,
      data: {
        messages,
        nextCursor,
        selfDestructHours: chat.self_destruct_hours,
        myRating: rating?.stars ?? null,
        otherUserId,
      },
    })
  } catch (error) {
    console.error("Chat open error:", error)
    return NextResponse.json({ ok: false, error: "Failed to open chat" }, { status: 500 })
  }
}
