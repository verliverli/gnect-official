import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { MEDIA_LIMITS, TELEGRAM_MEDIA } from "@/lib/constants"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("photo") as File | null
    const isFacePic = formData.get("is_face_pic") === "true"
    const isLocked = formData.get("is_locked") === "true"

    // Validate file exists
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "Only JPEG, PNG, and WebP images allowed" }, { status: 400 })
    }

    // Validate file size
    if (file.size > MEDIA_LIMITS.MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be under 2MB" }, { status: 400 })
    }

    // Check photo count limit
    const photoCount = await db.profilePhoto.count({ where: { user_id: user.id } })
    const maxPhotos = MEDIA_LIMITS.MAX_FREE_PROFILE_PHOTOS

    if (photoCount >= maxPhotos) {
      return NextResponse.json(
        { ok: false, error: `Photo limit reached (${maxPhotos} photos max)` },
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

    // Store as "tg:{file_id}" — getMediaUrl() converts to display URL
    const mediaUrl = `tg:${fileId}`

    // Create photo record in database
    const photo = await db.profilePhoto.create({
      data: {
        user_id: user.id,
        catbox_url: mediaUrl, // Reusing existing field for Telegram file_id (with tg: prefix)
        is_face_pic: isFacePic,
        is_locked: isLocked,
        upload_order: photoCount + 1,
      },
    })

    return NextResponse.json({ ok: true, data: photo })
  } catch (error) {
    console.error("Photo upload error:", error)
    return NextResponse.json({ ok: false, error: "Failed to upload photo" }, { status: 500 })
  }
}
