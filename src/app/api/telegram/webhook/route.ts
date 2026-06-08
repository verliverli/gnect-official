import { NextRequest, NextResponse } from "next/server"

const BOT_TOKEN = process.env.TELEGRAM_MINIAPP_BOT_TOKEN || ""
const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""

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
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🟢 **GNECT**\n\nHOOKUPS ONLY\n\nTap the button below to open GNECT 👇",
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🟢 Open GNECT',
                web_app: { url: WEB_APP_URL },
              },
            ]],
          },
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
