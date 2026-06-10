import { NextResponse } from 'next/server'

// APK download info endpoint
// Returns whether the Android APK is available for download and its metadata
export async function GET() {
  try {
    // Fetch the download info JSON from static files
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || ''

    const infoRes = await fetch(`${baseUrl}/downloads/download-info.json`, {
      next: { revalidate: 60 }, // Cache for 60s
    })
    if (!infoRes.ok) {
      return NextResponse.json({ ok: false, available: false })
    }

    const info = await infoRes.json()

    // Check if APK file exists by HEAD request
    let available = false
    if (info.filename) {
      try {
        const apkRes = await fetch(`${baseUrl}/downloads/${info.filename}`, { method: 'HEAD' })
        available = apkRes.ok
      } catch {
        available = false
      }
    }

    return NextResponse.json({
      ok: true,
      available,
      version: info.version,
      size: info.size,
      minAndroidVersion: info.minAndroidVersion,
      changelog: info.changelog,
      downloadUrl: available ? `/downloads/${info.filename}` : null,
      generatedAt: info.generatedAt,
    })
  } catch {
    return NextResponse.json({ ok: false, available: false })
  }
}
