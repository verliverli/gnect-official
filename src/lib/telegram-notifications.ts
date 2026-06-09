// ============================================
// GNECT Telegram Bot Notifications
// Send messages directly to users via Telegram bot
// This is the #1 engagement driver — users get notified even when app is closed
// ============================================

import { db } from './db'

const BOT_TOKEN = process.env.TELEGRAM_MINIAPP_BOT_TOKEN || ""
const WEB_APP_URL = "https://gnect.vercel.app"

interface TelegramNotificationParams {
  userId: string
  title: string
  body: string
  type?: string // "message" | "community" | "admin_broadcast" | etc.
  openUrl?: string // Deep link URL to open in the app
}

/**
 * Send a notification message to a user via Telegram bot.
 * Only sends if the user has a telegram_chat_id (set when they open the bot).
 * Respects user notification settings.
 */
export async function sendTelegramNotification({
  userId,
  title,
  body,
  type = 'message',
  openUrl,
}: TelegramNotificationParams): Promise<boolean> {
  if (!BOT_TOKEN) return false

  try {
    // Get user's telegram_chat_id and notification settings
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        telegram_chat_id: true,
        notification_settings: true,
        is_banned: true,
      },
    })

    // No chat_id means user never opened the bot — can't send Telegram notification
    if (!user?.telegram_chat_id) return false
    if (user.is_banned) return false

    // Check notification settings
    const settings = (() => {
      try {
        return user.notification_settings ? JSON.parse(user.notification_settings) : null
      } catch {
        return null
      }
    })()

    // Admin broadcasts always go through
    if (type !== 'admin_broadcast' && type !== 'admin_event' && settings) {
      const typeMap: Record<string, string> = {
        message: 'messages',
        community: 'community',
        profile_view: 'profileViews',
        profile_save: 'profileSaves',
        group_message: 'community',
      }
      const settingKey = typeMap[type]
      if (settingKey && !settings[settingKey]) return false // User disabled this type
    }

    // Build the message text
    const text = `*${escapeMarkdown(title)}*\n\n${escapeMarkdown(body)}`

    // Build inline keyboard with "Open GNECT" button
    const replyMarkup = {
      inline_keyboard: [[
        {
          text: '🟢 Open GNECT',
          web_app: { url: openUrl || WEB_APP_URL },
        },
      ]],
    }

    // Send via Telegram Bot API
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_chat_id,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('[telegram-notif] Failed:', res.status, JSON.stringify(errData))

      // If user blocked the bot (403), clear their chat_id so we stop trying
      if (res.status === 403) {
        await db.user.update({
          where: { id: userId },
          data: { telegram_chat_id: null },
        }).catch(() => {})
      }
      return false
    }

    return true
  } catch (err) {
    console.error('[telegram-notif] Error:', err)
    return false
  }
}

/**
 * Send a Telegram notification to ALL users with a telegram_chat_id.
 * Used for admin broadcasts, announcements, etc.
 */
export async function sendTelegramBroadcast({
  title,
  body,
  targetCountry,
  targetRegion,
  openUrl,
}: {
  title: string
  body: string
  targetCountry?: string
  targetRegion?: string
  openUrl?: string
}): Promise<{ sent: number; failed: number }> {
  if (!BOT_TOKEN) return { sent: 0, failed: 0 }

  try {
    // Find all users with telegram_chat_id who aren't banned
    const where: any = {
      telegram_chat_id: { not: null },
      is_banned: false,
    }
    if (targetCountry) where.country = targetCountry
    if (targetRegion) where.region = targetRegion

    const users = await db.user.findMany({
      where,
      select: { id: true, telegram_chat_id: true },
    })

    let sent = 0
    let failed = 0

    // Send in batches of 30 (Telegram rate limit: ~30 messages per second)
    for (let i = 0; i < users.length; i += 30) {
      const batch = users.slice(i, i + 30)

      const results = await Promise.allSettled(
        batch.map((user) =>
          sendTelegramNotification({
            userId: user.id,
            title,
            body,
            type: 'admin_broadcast',
            openUrl,
          })
        )
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) sent++
        else failed++
      }

      // Wait 1 second between batches to respect rate limits
      if (i + 30 < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return { sent, failed }
  } catch (err) {
    console.error('[telegram-broadcast] Error:', err)
    return { sent: 0, failed: 0 }
  }
}

// Escape special Markdown characters for Telegram
function escapeMarkdown(text: string): string {
  return text
    .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
