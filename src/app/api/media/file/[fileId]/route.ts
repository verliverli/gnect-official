import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"

// ============================================
// In-memory LRU cache for Telegram getFile path lookups
// File paths never change for a given file_id, so we cache them forever
// ============================================
const filePathCache = new Map<string, string>()
const FILE_PATH_CACHE_MAX = 1000

function cacheFilePath(fileId: string, filePath: string): void {
  // Evict oldest entry if at capacity
  if (filePathCache.size >= FILE_PATH_CACHE_MAX) {
    const firstKey = filePathCache.keys().next().value
    if (firstKey) filePathCache.delete(firstKey)
  }
  filePathCache.set(fileId, filePath)
}

// ============================================
// In-memory response cache for small files (thumbnails, icons)
// Avoids re-fetching from Telegram for frequently requested small images
// ============================================
interface CachedResponse {
  data: Buffer
  contentType: string
  etag: string
  contentLength: number
  timestamp: number
}
const responseCache = new Map<string, CachedResponse>()
const RESPONSE_CACHE_MAX = 200
const RESPONSE_CACHE_MAX_BYTES = 200 * 1024 // Only cache files <= 200KB

function cacheResponse(fileId: string, quality: string, data: Buffer, contentType: string, contentLength: number): void {
  if (data.length > RESPONSE_CACHE_MAX_BYTES) return // Don't cache large files
  if (responseCache.size >= RESPONSE_CACHE_MAX) {
    const firstKey = responseCache.keys().next().value
    if (firstKey) responseCache.delete(firstKey)
  }
  const etag = `"${createHash('md5').update(data).digest('hex').slice(0, 16)}"`
  responseCache.set(`${fileId}:${quality}`, { data, contentType, etag, contentLength, timestamp: Date.now() })
}

// Generate ETag from fileId
function generateETag(fileId: string, quality: string): string {
  return `"${fileId.slice(0, 16)}-${quality}"`
}

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

    // Parse quality parameter
    const url = new URL(request.url)
    const quality = url.searchParams.get("quality") || "full" // "thumbnail" or "full"

    // Check ETag for conditional requests — avoid re-downloading unchanged files
    const etag = generateETag(fileId, quality)
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    // Check in-memory response cache first (for small/thumbnail files)
    const cacheKey = `${fileId}:${quality}`
    const cached = responseCache.get(cacheKey)
    if (cached) {
      const headers = new Headers({
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': cached.etag,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(cached.contentLength),
        'X-Cache': 'HIT',
      })
      return new NextResponse(cached.data, { status: 200, headers })
    }

    // Step 1: Get file path from Telegram Bot API (with LRU cache)
    let filePath: string | undefined = filePathCache.get(fileId)

    if (!filePath) {
      // Use CF Worker proxy for getFile to bypass TZ/KE blocks
      const cfWorkerUrl = process.env.CF_MEDIA_WORKER_URL || "https://gnect-media.03mrfrancis.workers.dev"
      const getFileUrl = `${cfWorkerUrl}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
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

      filePath = fileData.result.file_path
      // Cache the file path forever — it never changes for a given file_id
      cacheFilePath(fileId, filePath)
    }

    // Step 2: For thumbnails, modify the file path to request the smallest photo size
    // Telegram photo sizes: s, m, x, y, w (small to large)
    // The file_path contains the size suffix — we can try to request a smaller version
    let downloadPath = filePath
    if (quality === "thumbnail") {
      // For photos, Telegram stores different sizes with different file_paths
      // The file_path pattern is: photos/XXXXX.jpg or photos/XXXXX_s.jpg etc.
      // We attempt to use the '_s' suffix for the smallest thumbnail
      // If the file already has a size suffix, replace it; if not, append '_s'
      const pathParts = filePath.split('/')
      const filename = pathParts[pathParts.length - 1]
      const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
      const ext = filename.slice(nameWithoutExt.length)

      // If filename already has a size suffix (_s, _m, _x, _y, _w), replace with _s
      if (/_[smxyw]$/.test(nameWithoutExt)) {
        pathParts[pathParts.length - 1] = nameWithoutExt.replace(/_[smxyw]$/, '_s') + ext
      } else {
        // No size suffix — try appending _s for thumbnail
        pathParts[pathParts.length - 1] = nameWithoutExt + '_s' + ext
      }
      downloadPath = pathParts.join('/')
    }

    // Step 3: Fetch the actual file data from Telegram via CF Worker proxy
    const cfWorkerUrl = process.env.CF_MEDIA_WORKER_URL || "https://gnect-media.03mrfrancis.workers.dev"
    const directUrl = `${cfWorkerUrl}/file/bot${botToken}/${downloadPath}`

    let mediaRes = await fetch(directUrl, { signal: AbortSignal.timeout(30000) })

    // If thumbnail path failed (file might not have _s variant), fall back to original path
    if (!mediaRes.ok && quality === "thumbnail" && downloadPath !== filePath) {
      const fallbackUrl = `${cfWorkerUrl}/file/bot${botToken}/${filePath}`
      mediaRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(30000) })
    }

    if (!mediaRes.ok) {
      console.error("Telegram file download error:", mediaRes.status)
      return NextResponse.json({ ok: false, error: "Failed to download file" }, { status: 502 })
    }

    // Determine content type from file extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentType = getContentType(ext)

    // For small files (thumbnails), buffer and cache the entire response
    const contentLength = mediaRes.headers.get('content-length')
    const contentLengthNum = contentLength ? parseInt(contentLength, 10) : 0

    if (contentLengthNum > 0 && contentLengthNum <= RESPONSE_CACHE_MAX_BYTES) {
      // Buffer the response for caching
      const arrayBuffer = await mediaRes.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Cache it
      cacheResponse(fileId, quality, buffer, contentType, contentLengthNum)

      const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(contentLengthNum),
        'X-Cache': 'MISS',
      })

      return new NextResponse(buffer, { status: 200, headers })
    }

    // For large files (full photos, voice notes), stream directly without caching in memory
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year — file_ids are permanent
      'ETag': etag,
      'Accept-Ranges': 'bytes',
      'X-Cache': 'MISS',
    })

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
