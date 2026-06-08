import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS } from "@/lib/constants"

// PUT /api/chat/[chatId]/mark-read — Mark messages as read (viewed)
export async function PUT(
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

    // Verify user is a participant
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: { id: true, user1_id: true, user2_id: true },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant" }, { status: 403 })
    }

    const now = new Date()

    // Get message IDs to mark as read
    const body = await request.json().catch(() => ({}))
    const { messageIds } = body as { messageIds?: string[] }

    let idsToMark: string[]

    if (messageIds && messageIds.length > 0) {
      // Mark specific messages, but EXCLUDE view-once photos
      // View-once photos can only be marked as viewed through the /view-once API
      const specificMessages = await db.message.findMany({
        where: {
          id: { in: messageIds },
          is_view_once: false,
        },
        select: { id: true },
      })
      idsToMark = specificMessages.map((m) => m.id)
    } else {
      // Mark all unread messages in this chat from the other user
      // EXCLUDE view-once photos — they can only be marked as viewed through
      // the explicit /view-once API (user must tap → fullscreen → close)
      const unreadMessages = await db.message.findMany({
        where: {
          chat_id: chatId,
          sender_id: { not: user.id },
          viewed: false,
          is_unsent: false,
          is_view_once: false,
        },
        select: { id: true },
      })
      idsToMark = unreadMessages.map((m) => m.id)
    }

    if (idsToMark.length > 0) {
      // Mark as viewed
      await db.message.updateMany({
        where: { id: { in: idsToMark } },
        data: { viewed: true, viewed_at: now },
      })

      // Update auto-delete timers for media messages that are now viewed
      // Opened media = 24h to live
      const mediaMessages = await db.message.findMany({
        where: {
          id: { in: idsToMark },
          media_url: { not: null },
          is_view_once: false,
        },
        select: { id: true },
      })

      if (mediaMessages.length > 0) {
        const openedDeleteAt = new Date(now.getTime() + MEDIA_LIMITS.OPENED_MEDIA_DELETE_HOURS * 60 * 60 * 1000)
        await db.message.updateMany({
          where: { id: { in: mediaMessages.map((m) => m.id) } },
          data: { auto_delete_at: openedDeleteAt },
        })
      }
    }

    return NextResponse.json({ ok: true, markedCount: idsToMark.length })
  } catch (error) {
    console.error("Mark read error:", error)
    return NextResponse.json({ ok: false, error: "Failed to mark as read" }, { status: 500 })
  }
}
