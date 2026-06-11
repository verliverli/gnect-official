import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, TELEGRAM_MEDIA } from "@/lib/constants"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const UPLOAD_TIMEOUT_MS = 60000 // 60s for slow connections in TZ/KE
const MAX_REQUEST_SIZE = 10 * 1024 * 1024 // 10MB — reject oversized requests early
const TELEGRAM_MAX_RETRIES = 1 // Retry once on Telegram API failure

// POST /api/chat/[chatId]/upload-media — Upload a photo for chat (via Telegram Bot API with retry)
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

    // Early request size check — reject before processing
    const contentLength = request.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Request too large — image must be under 10MB" },
        { status: 413 }
      )
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

    // Validate file size
    if (file.size > MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Image must be under ${Math.round(MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES / 1024 / 1024)}MB` },
        { status: 400 }
      )
    }

    // Upload to Telegram Bot API with retry logic
    const botToken = TELEGRAM_MEDIA.BOT_TOKEN
    const channelId = TELEGRAM_MEDIA.CHANNEL_ID

    if (!botToken || !channelId) {
      console.error("Telegram media credentials not configured")
      return NextResponse.json({ ok: false, error: "Media service not configured" }, { status: 500 })
    }

    let fileId: string
    let lastTelegramError: string | null = null

    // Try CF Worker proxy first, then direct Telegram API as fallback
    // CF Worker uses /bot/method (has its own BOT_TOKEN), Direct API uses /bot{token}/method
    const apiEndpoints = [
      { base: TELEGRAM_MEDIA.API_BASE, isCf: true },        // CF Worker proxy (primary)
      { base: TELEGRAM_MEDIA.DIRECT_API_BASE, isCf: false }, // Direct Telegram API (fallback)
    ]

    for (let attempt = 0; attempt <= TELEGRAM_MAX_RETRIES; attempt++) {
      for (const endpoint of apiEndpoints) {
        try {
          const telegramForm = new FormData()
          telegramForm.append("chat_id", channelId)
          telegramForm.append("photo", file)

          const uploadUrl = endpoint.isCf
            ? `${endpoint.base}/bot/sendPhoto`
            : `${endpoint.base}/bot${botToken}/sendPhoto`

          const telegramRes = await fetch(uploadUrl,
            {
              method: "POST",
              body: telegramForm,
              signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
            }
          )

          if (!telegramRes.ok) {
            const errText = await telegramRes.text().catch(() => "Unknown error")
            lastTelegramError = `Telegram API error ${telegramRes.status}: ${errText.slice(0, 200)}`
            console.error(`[Chat Upload] ${lastTelegramError} (endpoint: ${endpoint.base})`)
            // Try next endpoint
            continue
          }

          const telegramData = await telegramRes.json()
          if (!telegramData.ok || !telegramData.result?.photo?.[0]?.file_id) {
            lastTelegramError = `Telegram unexpected response: ${JSON.stringify(telegramData).slice(0, 200)}`
            console.error(`[Chat Upload] ${lastTelegramError}`)
            // Try next endpoint
            continue
          }

          // Success — use the largest photo size's file_id for best quality
          const photos = telegramData.result.photo
          fileId = photos[photos.length - 1].file_id

          // Store as "tg:{file_id}" in database — our getMediaUrl() helper converts this
          const mediaUrl = `tg:${fileId}`

          return NextResponse.json({ ok: true, data: { url: mediaUrl } })
        } catch (uploadErr) {
          const errMsg = uploadErr instanceof Error ? uploadErr.message : "Unknown upload error"
          lastTelegramError = errMsg
          console.error(`[Chat Upload] Error (endpoint: ${endpoint.base}, attempt: ${attempt + 1}):`, errMsg)
          // Try next endpoint on this attempt
          continue
        }
      }

      // If we've tried all endpoints and still failed, wait before retrying
      if (attempt < TELEGRAM_MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt) // Exponential backoff: 1s, 2s
        console.log(`[Chat Upload] All endpoints failed, retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }

    // All attempts failed
    console.error(`[Chat Upload] All attempts failed. Last error: ${lastTelegramError}`)
    return NextResponse.json(
      { ok: false, error: "Image upload failed — storage service unavailable. Please try again." },
      { status: 503 }
    )
  } catch (error) {
    console.error("Chat media upload error:", error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
      return NextResponse.json(
        { ok: false, error: "Upload timed out — your connection may be slow. Please try again." },
        { status: 504 }
      )
    }
    return NextResponse.json({ ok: false, error: "Failed to upload media — please try again" }, { status: 500 })
  }
}
