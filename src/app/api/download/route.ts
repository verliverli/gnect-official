import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

// APK download info endpoint
// Reads download-info.json directly from the filesystem and checks if APK exists
export async function GET() {
  try {
    const infoPath = join(process.cwd(), 'public', 'downloads', 'download-info.json')
    const infoRaw = await readFile(infoPath, 'utf-8')
    const info = JSON.parse(infoRaw)

    // Check if APK file actually exists on disk
    let available = false
    if (info.filename) {
      try {
        const apkPath = join(process.cwd(), 'public', 'downloads', info.filename)
        await readFile(apkPath)
        available = true
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

// POST — track download click (no-op, just returns ok so the fetch doesn't 404)
export async function POST() {
  return NextResponse.json({ ok: true })
}
