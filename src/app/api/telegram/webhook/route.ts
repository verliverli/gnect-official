import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

const BOT_TOKEN = process.env.TELEGRAM_MINIAPP_BOT_TOKEN || ""
const WEB_APP_URL = "https://gnect.vercel.app"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body?.message) {
      return NextResponse.json({ ok: true })
    }

    const { message } = body
    const chatId = message.chat?.id

    if (!chatId || !BOT_TOKEN) {
      return NextResponse.json({ ok: true })
    }

    // Handle /start command
    if (message.text?.startsWith('/start')) {
      const startParam = message.text.split(' ')[1] || ''

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🔒 **GNECT — Connect privately. No names, no traces.**\n\nYour secret space to meet, chat, and connect — anonymously.\n\n🔥 Find people near you\n💬 Disappearing messages\n🤫 Discretion mode\n🎭 Anonymous confessions\n\nTap below to open 👇",
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🟢 Open GNECT',
                web_app: { url: startParam ? `${WEB_APP_URL}?start=${startParam}` : WEB_APP_URL },
              },
            ], [
              {
                text: '❓ Help',
                callback_data: 'help',
              },
            ]],
          },
        }),
      })

      // Save telegram_chat_id for any user who has this chatId
      // This happens BEFORE login — when they open the bot
      // The frontend will link it to their account later
    }

    // Handle /help command
    if (message.text?.startsWith('/help') || message.text === 'help') {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❓ **GNECT Help**\n\n🔒 **Privacy First:**\n• No phone, no email needed\n• Your data stays in your country\n• Disappearing messages\n• Discretion mode hides your presence\n\n🎭 **Confessions:**\n• Post anonymously — no one knows it's you\n• React with emojis only\n• Auto-delete after 7 days\n\n💬 **Chat:**\n• Self-destructing messages\n• View-once photos\n• Quick replies\n\n🆘 **Support:**\n• Use the in-app Support button\n• Or tap Open GNECT → Settings → Support\n\n🇶🇦🇸🇦🇦🇪🇵🇱 Available in Qatar, Saudi Arabia, UAE & Poland",
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

    // Handle callback queries (button presses)
    if (body.callback_query?.data === 'help') {
      const cbChatId = body.callback_query.message?.chat?.id
      if (cbChatId) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cbChatId,
            text: "❓ **GNECT Help**\n\n🔒 **Privacy First:**\n• No phone, no email needed\n• Your data stays in your country\n• Disappearing messages\n• Discretion mode hides your presence\n\n🎭 **Confessions:**\n• Post anonymously — no one knows it's you\n• React with emojis only\n• Auto-delete after 7 days\n\n💬 **Chat:**\n• Self-destructing messages\n• View-once photos\n• Quick replies\n\n🆘 **Support:**\n• Use the in-app Support button\n• Or tap Open GNECT → Settings → Support\n\n🇶🇦🇸🇦🇦🇪🇵🇱 Available in Qatar, Saudi Arabia, UAE & Poland",
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

      // Answer callback query to dismiss the loading state
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: body.callback_query.id,
        }),
      })
    }

    // Save chat_id — try to link to existing user by telegram_chat_id
    // This will be updated when user logs in via the Mini App
    try {
      await db.user.updateMany({
        where: { telegram_chat_id: String(chatId) },
        data: { telegram_chat_id: String(chatId) },
      })
    } catch {
      // Ignore — will be linked when user opens the app
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
