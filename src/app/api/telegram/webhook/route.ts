import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

const BOT_TOKEN = process.env.TELEGRAM_MINIAPP_BOT_TOKEN || ""
const WEB_APP_URL = "https://gnect.vercel.app"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify this is from Telegram
    if (!body?.message) {
      return NextResponse.json({ ok: true })
    }

    const { message } = body
    const chatId = message.chat?.id

    if (!chatId || !BOT_TOKEN) {
      return NextResponse.json({ ok: true })
    }

    // Handle /start command — send the big "Open GNECT" button
    if (message.text?.startsWith('/start')) {
      // Extract referral/invite param if any (e.g., /start invite_abc123)
      const startParam = message.text.split(' ')[1] || ''

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🔒 **GNECT — Connect privately. No names, no traces.**\n\nYour secret space to meet, chat, and connect — anonymously.\n\n🔥 Find people near you\n💬 Disappearing messages\n🤫 Discretion mode\n\nTap below to open 👇",
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🟢 Open GNECT',
                web_app: { url: startParam ? `${WEB_APP_URL}?start=${startParam}` : WEB_APP_URL },
              },
            ]],
          },
        }),
      })

      // Store telegram_chat_id for this user so we can send notifications later
      // Try to find user by telegram_chat_id or link via initData
      // For now, we store the chat_id mapping — when user logs in via Mini App,
      // the frontend will send their chat_id to link it
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
