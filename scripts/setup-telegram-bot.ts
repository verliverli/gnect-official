// ============================================
// GNECT — Telegram Bot Setup
// Configures @GNECT_app_bot with a web app button
// Run: bun run scripts/setup-telegram-bot.ts
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_MINIAPP_BOT_TOKEN || ""
const BOT_USERNAME = process.env.TELEGRAM_MINIAPP_BOT_USERNAME || "GNECT_app_bot"
const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL || "https://gnect.vercel.app"

async function setupBot() {
  console.log(`Setting up @${BOT_USERNAME}...`)

  // 1. Set bot commands (minimal — we want the button, not commands)
  const commandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Open GNECT' },
      ],
    }),
  })
  const commandsData = await commandsRes.json()
  console.log('Set commands:', commandsData.ok ? '✅' : '❌', commandsData.description || '')

  // 2. Set bot description
  const descRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'GNECT — No dating. No relationships. Just meet.\n\nTap the button below to open GNECT inside Telegram 👇',
    }),
  })
  const descData = await descRes.json()
  console.log('Set description:', descData.ok ? '✅' : '❌')

  // 3. Set short description
  const shortDescRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_description: 'Hook up — No dating, no relationships. Just meet.',
    }),
  })
  const shortDescData = await shortDescRes.json()
  console.log('Set short description:', shortDescData.ok ? '✅' : '❌')

  // 4. Set menu button to web app
  const menuRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Open GNECT 🟢',
        web_app: { url: WEB_APP_URL },
      },
    }),
  })
  const menuData = await menuRes.json()
  console.log('Set menu button:', menuData.ok ? '✅' : '❌', JSON.stringify(menuData))

  // 5. Get bot info
  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
  const infoData = await infoRes.json()
  if (infoData.ok) {
    console.log(`\n✅ Bot configured: @${infoData.result.username}`)
    console.log(`   Name: ${infoData.result.first_name}`)
  }

  console.log('\n🎉 Setup complete! Users can now:')
  console.log('   1. Open @GNECT_app_bot in Telegram')
  console.log('   2. See "Open GNECT 🟢" button')
  console.log('   3. Tap it → GNECT opens as Mini App')
}

setupBot().catch(console.error)
