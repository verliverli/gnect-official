import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/lib/constants'

const ALLOWED_KEYS = ['messages', 'community', 'profileViews', 'profileSaves', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'discreetNotifStyle', 'stealth_icon', 'safePageId']

// GET /api/notifications/settings — Get notification settings
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // Use notification_settings from getCurrentUser directly, fallback to DB query
    let settings = DEFAULT_NOTIFICATION_SETTINGS
    if ((user as any).notification_settings) {
      try {
        settings = JSON.parse((user as any).notification_settings)
      } catch {
        settings = DEFAULT_NOTIFICATION_SETTINGS
      }
    } else {
      // Fallback: fetch from DB if getCurrentUser doesn't include it
      const fullUser = await db.user.findUnique({
        where: { id: user.id },
        select: { notification_settings: true },
      })
      settings = fullUser?.notification_settings
        ? JSON.parse(fullUser.notification_settings)
        : DEFAULT_NOTIFICATION_SETTINGS
    }

    return NextResponse.json({ ok: true, data: settings })
  } catch (err) {
    console.error('Get notification settings error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

// PUT /api/notifications/settings — Update notification settings
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const updates = await req.json()

    // Filter to only allowed keys (prevents setting admin_broadcast etc.)
    const filteredUpdates: Record<string, any> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_KEYS.includes(key)) {
        filteredUpdates[key] = value
      }
    }

    // Use notification_settings from getCurrentUser directly, fallback to DB query
    let current = DEFAULT_NOTIFICATION_SETTINGS
    if ((user as any).notification_settings) {
      try {
        current = JSON.parse((user as any).notification_settings)
      } catch {
        current = DEFAULT_NOTIFICATION_SETTINGS
      }
    } else {
      // Fallback: fetch from DB if getCurrentUser doesn't include it
      const fullUser = await db.user.findUnique({
        where: { id: user.id },
        select: { notification_settings: true },
      })
      current = fullUser?.notification_settings
        ? JSON.parse(fullUser.notification_settings)
        : DEFAULT_NOTIFICATION_SETTINGS
    }

    const merged = { ...current, ...filteredUpdates }

    await db.user.update({
      where: { id: user.id },
      data: { notification_settings: JSON.stringify(merged) },
    })

    return NextResponse.json({ ok: true, data: merged })
  } catch (err) {
    console.error('Update notification settings error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
