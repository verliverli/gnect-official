import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, TELEGRAM_MEDIA } from "@/lib/constants"

const ALLOWED_AUDIO_TYPES = ["audio/ogg", "audio/opus", "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"]

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
    try {
      const telegramForm = new FormData()
      telegramForm.append("chat_id", channelId)
      telegramForm.append("voice", file)
      if (duration) {
        telegramForm.append("duration", duration)
      }

      const telegramRes = await fetch(
        `${TELEGRAM_MEDIA.API_BASE}/bot${botToken}/sendVoice`,
        {
          method: "POST",
          body: telegramForm,
          signal: AbortSignal.timeout(30000),
        }
      )

      if (!telegramRes.ok) {
        const errText = await telegramRes.text().catch(() => "Unknown error")
        console.error("Telegram voice upload error:", telegramRes.status, errText)
        return NextResponse.json(
          { ok: false, error: "Voice note upload failed — storage service error" },
          { status: 500 }
        )
      }

      const telegramData = await telegramRes.json()
      if (!telegramData.ok || !telegramData.result?.voice?.file_id) {
        console.error("Telegram unexpected response:", telegramData)
        return NextResponse.json(
          { ok: false, error: "Voice note upload failed — invalid response" },
          { status: 500 }
        )
      }

      fileId = telegramData.result.voice.file_id
    } catch (uploadErr) {
      console.error("Telegram voice upload error:", uploadErr)
      return NextResponse.json(
        { ok: false, error: "Voice note upload timed out or failed — please try again" },
        { status: 504 }
      )
    }

    const mediaUrl = `tg:${fileId}`

    return NextResponse.json({
      ok: true,
      data: {
        url: mediaUrl,
        duration: duration ? parseInt(duration, 10) : 0,
      },
    })
  } catch (error) {
    console.error("Group voice upload error:", error)
    return NextResponse.json({ ok: false, error: "Failed to upload voice note" }, { status: 500 })
  }
}
