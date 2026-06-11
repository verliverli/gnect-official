import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, TELEGRAM_MEDIA } from "@/lib/constants"

const ALLOWED_AUDIO_TYPES = ["audio/ogg", "audio/opus", "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"]
const UPLOAD_TIMEOUT_MS = 60000 // 60s for slow connections in TZ/KE
const TELEGRAM_MAX_RETRIES = 1 // Retry once on Telegram API failure

// POST /api/group/[roomId]/upload-voice — Upload a voice note for group chat (via Telegram Bot API)
// - Same flow as chat upload-voice but verifies group membership instead of chat participation
export async function POST(
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

    // Verify user is a member of this group room
    const membership = await db.groupMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      select: { id: true },
    })

    if (!membership) {
      return NextResponse.json({ ok: false, error: "You are not a member of this room" }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("audio") as File | null
    const duration = formData.get("duration") as string | null

    if (!file) {
      return NextResponse.json({ ok: false, error: "No audio file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
      return NextResponse.json(
        { ok: false, error: "Only audio files are allowed" },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MEDIA_LIMITS.MAX_VOICE_NOTE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Voice note must be under 5MB" },
        { status: 400 }
      )
    }

    // Upload to Telegram Bot API
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
          telegramForm.append("voice", file)
          if (duration) {
            telegramForm.append("duration", duration)
          }

          const uploadUrl = endpoint.isCf
            ? `${endpoint.base}/bot/sendVoice`
            : `${endpoint.base}/bot${botToken}/sendVoice`

          const telegramRes = await fetch(uploadUrl, {
            method: "POST",
            body: telegramForm,
            signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
          })

          if (!telegramRes.ok) {
            const errText = await telegramRes.text().catch(() => "Unknown error")
            lastTelegramError = `Telegram API error ${telegramRes.status}: ${errText.slice(0, 200)}`
            console.error(`[Group Voice Upload] ${lastTelegramError} (endpoint: ${endpoint.base})`)
            // Try next endpoint
            continue
          }

          const telegramData = await telegramRes.json()
          if (!telegramData.ok || !telegramData.result?.voice?.file_id) {
            lastTelegramError = `Telegram unexpected response: ${JSON.stringify(telegramData).slice(0, 200)}`
            console.error(`[Group Voice Upload] ${lastTelegramError}`)
            // Try next endpoint
            continue
          }

          fileId = telegramData.result.voice.file_id

          const mediaUrl = `tg:${fileId}`

          return NextResponse.json({
            ok: true,
            data: {
              url: mediaUrl,
              duration: duration ? parseInt(duration, 10) : 0,
            },
          })
        } catch (uploadErr) {
          const errMsg = uploadErr instanceof Error ? uploadErr.message : "Unknown upload error"
          lastTelegramError = errMsg
          console.error(`[Group Voice Upload] Error (endpoint: ${endpoint.base}, attempt: ${attempt + 1}):`, errMsg)
          // Try next endpoint on this attempt
          continue
        }
      }

      // If we've tried all endpoints and still failed, wait before retrying
      if (attempt < TELEGRAM_MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt) // Exponential backoff: 1s, 2s
        console.log(`[Group Voice Upload] All endpoints failed, retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }

    // All attempts failed
    console.error(`[Group Voice Upload] All attempts failed. Last error: ${lastTelegramError}`)
    return NextResponse.json(
      { ok: false, error: "Voice note upload failed — storage service unavailable. Please try again." },
      { status: 503 }
    )
  } catch (error) {
    console.error("Group voice upload error:", error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
      return NextResponse.json(
        { ok: false, error: "Upload timed out — your connection may be slow. Please try again." },
        { status: 504 }
      )
    }
    return NextResponse.json({ ok: false, error: "Failed to upload voice note" }, { status: 500 })
  }
}
