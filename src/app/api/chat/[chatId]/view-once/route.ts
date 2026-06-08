import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// PUT /api/chat/[chatId]/view-once?messageId=xxx — Mark a view-once photo as viewed
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
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!chatId || !messageId) {
      return NextResponse.json({ ok: false, error: "chatId and messageId are required" }, { status: 400 })
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

    // Find the message
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        chat_id: true,
        sender_id: true,
        is_view_once: true,
        viewed: true,
      },
    })

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 })
    }

    if (message.chat_id !== chatId) {
      return NextResponse.json({ ok: false, error: "Message not in this chat" }, { status: 400 })
    }

    // Must be a view-once message
    if (!message.is_view_once) {
      return NextResponse.json({ ok: false, error: "Not a view-once message" }, { status: 400 })
    }

    // Cannot mark own message as viewed (only the receiver can)
    if (message.sender_id === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot view your own view-once message" }, { status: 400 })
    }

    // Already viewed
    if (message.viewed) {
      return NextResponse.json({ ok: true })
    }

    // Mark as viewed — NO auto-delete timer. User controls deletion via X (delete both sides).
    const now = new Date()

    await db.message.update({
      where: { id: messageId },
      data: {
        viewed: true,
        viewed_at: now,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("View-once error:", error)
    return NextResponse.json({ ok: false, error: "Failed to mark as viewed" }, { status: 500 })
  }
}

// DELETE /api/chat/[chatId]/view-once?messageId=xxx — Delete view-once photo for BOTH sides
// Called when the RECEIVER clicks the red X button in the photo viewer
// This is different from /unsend which only the SENDER can use
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { chatId } = await params
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!chatId || !messageId) {
      return NextResponse.json({ ok: false, error: "chatId and messageId are required" }, { status: 400 })
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

    // Find the message
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        chat_id: true,
        sender_id: true,
        is_view_once: true,
        viewed: true,
        is_unsent: true,
      },
    })

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 })
    }

    if (message.chat_id !== chatId) {
      return NextResponse.json({ ok: false, error: "Message not in this chat" }, { status: 400 })
    }

    // Must be a view-once message
    if (!message.is_view_once) {
      return NextResponse.json({ ok: false, error: "Not a view-once message" }, { status: 400 })
    }

    // Either participant can delete a view-once photo — this is the PRIVACY design
    // The receiver clicks X → deletes for both sides
    // The sender can also delete their own unsent view-once photo

    // Already deleted
    if (message.is_unsent) {
      return NextResponse.json({ ok: true })
    }

    // Mark as viewed + unsent and clear media (delete for both sides)
    await db.message.update({
      where: { id: messageId },
      data: {
        viewed: true,
        viewed_at: new Date(),
        is_unsent: true,
        media_url: null,
        // Keep media_type as 'view_once_photo' so both sides see the placeholder card
      },
    })

    // Notify the chat service to relay the delete event to the other user
    const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || ''
    const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id

    // Emit notification to the other user about the view-once deletion
    fetch(`${CHAT_SERVICE_URL}/emit-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: otherUserId,
        notification: {
          id: `vo-del-${messageId}`,
          type: 'view_once_deleted',
          title: '🔏 Photo deleted',
          body: 'A view-once photo was deleted',
          data: { chatId, messageId },
          is_read: false,
          created_at: new Date().toISOString(),
        },
      }),
    }).catch(() => {}) // Fire-and-forget

    return NextResponse.json({ ok: true, chatId, messageId })
  } catch (error) {
    console.error("View-once delete error:", error)
    return NextResponse.json({ ok: false, error: "Failed to delete view-once photo" }, { status: 500 })
  }
}
