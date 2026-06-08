import { NextRequest, NextResponse } from "next/server"

// GET /api/media/file/[fileId] — Proxy media files via Telegram Bot API
// Gulf users have direct Telegram access, but we still proxy through our server
// to avoid exposing the bot token on the client side.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params
    if (!fileId) {
      return NextResponse.json({ ok: false, error: "fileId is required" }, { status: 400 })
    }

    const botToken = process.env.GNECT_MEDIA_BOT_TOKEN
    if (!botToken) {
      console.error("GNECT_MEDIA_BOT_TOKEN not set")
      return NextResponse.json({ ok: false, error: "Media service not configured" }, { status: 500 })
    }

    // Step 1: Get file path from Telegram Bot API
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
    const fileRes = await fetch(getFileUrl, { signal: AbortSignal.timeout(10000) })

    if (!fileRes.ok) {
      console.error("Telegram getFile error:", fileRes.status)
      return NextResponse.json({ ok: false, error: "Failed to get file info" }, { status: 502 })
    }

    const fileData = await fileRes.json()
    if (!fileData.ok || !fileData.result?.file_path) {
      console.error("Telegram getFile unexpected response:", fileData)
      return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 })
    }

    const filePath = fileData.result.file_path

    // Step 2: Redirect to the direct Telegram file URL
    // Gulf users can access Telegram directly, so a redirect is fine
    const directUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`

    return NextResponse.redirect(directUrl)
  } catch (error) {
    console.error("Media proxy error:", error)
    return NextResponse.json({ ok: false, error: "Media fetch failed" }, { status: 500 })
  }
}
