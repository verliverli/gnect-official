import { NextRequest, NextResponse } from "next/server"

// GET /api/media/file/[fileId] — Proxy media files via Telegram Bot API
// Streams the file data through our server so the browser can play it
// (Redirects don't work reliably for Audio elements — cross-origin issues)
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

    // Step 2: Fetch the actual file data from Telegram and stream it back
    // This is more reliable than redirect — Audio elements need same-origin or CORS headers
    const directUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
    const mediaRes = await fetch(directUrl, { signal: AbortSignal.timeout(30000) })

    if (!mediaRes.ok) {
      console.error("Telegram file download error:", mediaRes.status)
      return NextResponse.json({ ok: false, error: "Failed to download file" }, { status: 502 })
    }

    // Determine content type from file extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentType = getContentType(ext)

    // Stream the file back with proper headers for audio/video playback
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 24h — file_ids are immutable
      'Accept-Ranges': 'bytes',
    })

    // Pass through content-length if available
    const contentLength = mediaRes.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    return new NextResponse(mediaRes.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Media proxy error:", error)
    return NextResponse.json({ ok: false, error: "Media fetch failed" }, { status: 500 })
  }
}

function getContentType(ext?: string): string {
  switch (ext) {
    case 'ogg':
    case 'opus':
      return 'audio/ogg; codecs=opus'
    case 'webm':
      return 'audio/webm'
    case 'mp3':
    case 'mpeg':
      return 'audio/mpeg'
    case 'mp4':
    case 'm4a':
      return 'audio/mp4'
    case 'wav':
      return 'audio/wav'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}
