import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, TELEGRAM_MEDIA } from "@/lib/constants"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

// POST /api/chat/[chatId]/upload-media — Upload a photo for chat (via direct Telegram Bot API)
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
      select: { id: true, user1_id: true, user2_id: true },
    })

    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found" }, { status: 404 })
    }

    if (chat.user1_id !== user.id && chat.user2_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Not a participant of this chat" }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("photo") as File | null

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only JPEG, PNG, and WebP images allowed" },
        { status: 400 }
      )
    }

    // Validate file size (2MB limit for chat photos)
    if (file.size > MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image must be under 2MB" },
        { status: 400 }
      )
    }

    // Upload directly to Telegram Bot API (no Cloudflare Worker)
    const botToken = TELEGRAM_MEDIA.BOT_TOKEN
    const channelId = TELEGRAM_MEDIA.CHANNEL_ID

    if (!botToken || !channelId) {
      console.error("Telegram media credentials not configured")
      return NextResponse.json({ ok: false, error: "Media service not configured" }, { status: 500 })
    }

    let fileId: string
    try {
      const telegramForm = new FormData()
      telegramForm.append("chat_id", channelId)
      telegramForm.append("photo", file)

      const telegramRes = await fetch(
        `${TELEGRAM_MEDIA.API_BASE}/bot${botToken}/sendPhoto`,
        {
          method: "POST",
          body: telegramForm,
          signal: AbortSignal.timeout(30000),
        }
      )

      if (!telegramRes.ok) {
        const errText = await telegramRes.text().catch(() => "Unknown error")
        console.error("Telegram upload error:", telegramRes.status, errText)
        return NextResponse.json(
          { ok: false, error: "Image upload failed — storage service error" },
          { status: 500 }
        )
      }

      const telegramData = await telegramRes.json()
      if (!telegramData.ok || !telegramData.result?.photo?.[0]?.file_id) {
        console.error("Telegram unexpected response:", telegramData)
        return NextResponse.json(
          { ok: false, error: "Image upload failed — invalid response" },
          { status: 500 }
        )
      }

      // Use the largest photo size's file_id for best quality
      const photos = telegramData.result.photo
      fileId = photos[photos.length - 1].file_id
    } catch (uploadErr) {
      console.error("Telegram upload error:", uploadErr)
      return NextResponse.json(
        { ok: false, error: "Image upload timed out or failed — please try again" },
        { status: 504 }
      )
    }

    // Store as "tg:{file_id}" in database — our getMediaUrl() helper converts this
    const mediaUrl = `tg:${fileId}`

    return NextResponse.json({ ok: true, data: { url: mediaUrl } })
  } catch (error) {
    console.error("Chat media upload error:", error)
    return NextResponse.json({ ok: false, error: "Failed to upload media" }, { status: 500 })
  }
}
