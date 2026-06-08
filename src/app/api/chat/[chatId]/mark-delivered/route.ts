import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// PUT /api/chat/[chatId]/mark-delivered — Mark messages as delivered
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

    if (!chat || (chat.user1_id !== user.id && chat.user2_id !== user.id)) {
      return NextResponse.json({ ok: false, error: "Not a participant" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      // Mark all undelivered messages in this chat (sent by the other user) as delivered
      await db.message.updateMany({
        where: {
          chat_id: chatId,
          sender_id: { not: user.id },
          delivered: false,
          is_unsent: false,
        },
        data: { delivered: true, delivered_at: new Date() },
      })
    } else {
      // Mark specific message as delivered
      await db.message.update({
        where: { id: messageId },
        data: { delivered: true, delivered_at: new Date() },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Mark delivered error:", error)
    return NextResponse.json({ ok: false, error: "Failed to mark delivered" }, { status: 500 })
  }
}
