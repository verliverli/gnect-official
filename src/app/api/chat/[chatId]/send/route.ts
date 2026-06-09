import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, containsLink } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { checkActionRateLimit, incrementActionRateLimit } from "@/lib/rate-limit"

// POST /api/chat/[chatId]/send — Send a message in a chat
export async function POST(
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
      select: { id: true, user1_id: true, user2_id: true, self_destruct_hours: true },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant of this chat" }, { status: 403 })
    }

    // P1.6: Check block status (both directions) — blocked users cannot send messages
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
      return NextResponse.json({ ok: false, error: "Cannot send message to blocked user" }, { status: 403 })
    }

    // P1.5: Rate limit — DISABLED during free beta (will re-enable with premium)
    // const canSend = await checkActionRateLimit(user.id, 'chat_send')
    // if (!canSend) {
    //   return NextResponse.json({ ok: false, error: "Rate limit exceeded. Please wait before sending more messages." }, { status: 429 })
    // }

    // Parse body
    let body: {
      content?: string
      media_url?: string
      media_type?: string
      is_view_once?: boolean
      view_once_duration?: number
      reply_to_id?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 })
    }

    const { content, media_url, media_type, is_view_once, view_once_duration, reply_to_id } = body

    // Either content or media_url must be provided
    if (!content && !media_url) {
      return NextResponse.json(
        { ok: false, error: "Either content or media_url must be provided" },
        { status: 400 }
      )
    }

    // Validate content length
    if (content && typeof content !== "string") {
      return NextResponse.json({ ok: false, error: "Content must be a string" }, { status: 400 })
    }

    if (content && content.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "Content must be 2000 characters or less" },
        { status: 400 }
      )
    }

    // P1.4: Server-side link validation — block URLs in messages
    // Skip for voice notes — their content is a duration number, not user text
    if (containsLink(content) && media_type !== "voice_note") {
      return NextResponse.json(
        { ok: false, error: "Links are not allowed in messages" },
        { status: 400 }
      )
    }

    // Validate media_url
    if (media_url && typeof media_url !== "string") {
      return NextResponse.json({ ok: false, error: "media_url must be a string" }, { status: 400 })
    }

    // Validate media_type
    const validMediaTypes = ["photo", "view_once_photo", "voice_note"]
    if (media_type && !validMediaTypes.includes(media_type)) {
      return NextResponse.json(
        { ok: false, error: "media_type must be 'photo', 'view_once_photo', or 'voice_note'" },
        { status: 400 }
      )
    }

    // If media_url is provided, media_type must also be provided
    if (media_url && !media_type) {
      return NextResponse.json(
        { ok: false, error: "media_type is required when media_url is provided" },
        { status: 400 }
      )
    }

    // Validate reply_to_id if provided
    if (reply_to_id) {
      const replyMessage = await db.message.findUnique({
        where: { id: reply_to_id },
        select: { id: true, chat_id: true },
      })
      if (!replyMessage || replyMessage.chat_id !== chatId) {
        return NextResponse.json(
          { ok: false, error: "Reply-to message not found in this chat" },
          { status: 400 }
        )
      }
    }

    // Calculate auto_delete_at and hard_delete_at
    // Rules: Text = 7 days hard limit. Photos unopened = 30 min. Photos opened = 24h.
    // View-once = 30 min unopened, then 24h after opening.
    // ALL messages have 7-day hard_delete_at as ultimate limit.
    // BUT if chat has self_destruct_hours set, use that for hard_delete_at instead.
    const now = new Date()
    let auto_delete_at: Date | null = null

    // If chat has a self-destruct timer, use it for hard_delete_at; otherwise default 7 days
    const hardDeleteHours = chat.self_destruct_hours ?? MEDIA_LIMITS.HARD_DELETE_DAYS * 24
    const hard_delete_at = new Date(now.getTime() + hardDeleteHours * 60 * 60 * 1000)

    if (is_view_once && media_type === "view_once_photo") {
      // View-once photos: 30 min unopened (will be updated to 24h when viewed)
      auto_delete_at = new Date(now.getTime() + MEDIA_LIMITS.UNOPENED_MEDIA_DELETE_MINUTES * 60 * 1000)
    } else if (media_url && media_type === "photo") {
      // Regular photos: 30 min unopened (will be updated to 24h when opened)
      auto_delete_at = new Date(now.getTime() + MEDIA_LIMITS.UNOPENED_MEDIA_DELETE_MINUTES * 60 * 1000)
    } else if (media_type === "voice_note") {
      // P1.12: Voice notes auto-delete after 7 days
      auto_delete_at = new Date(now.getTime() + MEDIA_LIMITS.VOICE_NOTE_DELETE_DAYS * 24 * 60 * 60 * 1000)
    }
    // Text messages: no auto_delete_at (only hard_delete_at at 7 days)

    // Create the message
    const message = await db.message.create({
      data: {
        chat_id: chatId,
        sender_id: user.id,
        content: content || null,
        media_url: media_url || null,
        media_type: media_type || null,
        is_view_once: is_view_once && media_type === "view_once_photo" ? true : false,
        view_once_duration: is_view_once && media_type === "view_once_photo" ? (view_once_duration === 5 ? 5 : 10) : null,
        reply_to_id: reply_to_id || null,
        auto_delete_at,
        hard_delete_at,
      },
      select: {
        id: true,
        sender_id: true,
        content: true,
        media_url: true,
        media_type: true,
        is_view_once: true,
        view_once_duration: true,
        sent_at: true,
        reply_to_id: true,
      },
    })

    // Update chat's last_message_at
    await db.chat.update({
      where: { id: chatId },
      data: { last_message_at: now },
    })

    // P1.5: Rate limit counter — DISABLED during free beta
    // await incrementActionRateLimit(user.id, 'chat_send')

    // Create notification for the other user
    // otherUserId already determined above (P1.6 block check)
    await createNotification({
      userId: otherUserId,
      type: 'message',
      title: '💬 New message',
      body: '🔔 New activity',
      data: { chatId, messageId: message.id },
    })

    return NextResponse.json({ ok: true, data: message })
  } catch (error) {
    console.error("Chat send error:", error)
    return NextResponse.json({ ok: false, error: "Failed to send message" }, { status: 500 })
  }
}
