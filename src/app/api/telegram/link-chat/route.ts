import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/telegram/link-chat
// Links a Telegram chat_id to the logged-in user account.
// Called by the Mini App frontend when it detects the user is inside Telegram.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { chatId } = await req.json()
    if (!chatId || typeof chatId !== "number") {
      return NextResponse.json({ error: "Invalid chat_id" }, { status: 400 })
    }

    // Update user's telegram_chat_id
    await db.user.update({
      where: { id: user.id },
      data: { telegram_chat_id: String(chatId) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Link chat error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
