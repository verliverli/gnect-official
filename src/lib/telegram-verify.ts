// ============================================
// GNECT TELEGRAM INITDATA VERIFICATION
// Cryptographically verifies Telegram MiniApp initData
// Prevents browser/fake registration — only real Telegram users
// ============================================

import { createHmac } from "crypto"

/**
 * Telegram initData is a query string like:
 *   query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22John%22%7D&auth_date=1694266531&hash=abc123...
 *
 * Verification algorithm (per Telegram docs):
 * 1. Parse the initData query string into key-value pairs
 * 2. Filter out the "hash" key
 * 3. Sort remaining keys alphabetically
 * 4. Create a data-check string: "key=value\nkey=value\n..."
 * 5. Compute HMAC-SHA256 with key = HMAC-SHA256(bot_token, "WebAppData")
 * 6. Compare the resulting hex with the provided hash
 */

function parseInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData)
  const map = new Map<string, string>()
  params.forEach((value, key) => {
    map.set(key, value)
  })
  return map
}

/**
 * Verify Telegram MiniApp initData signature
 * @param initData - The raw initData string from Telegram.WebApp.initData
 * @param botToken - The bot token (TELEGRAM_MINIAPP_BOT_TOKEN)
 * @returns true if signature is valid, false otherwise
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false

  try {
    const params = parseInitData(initData)
    const hash = params.get("hash")
    if (!hash) return false

    // Remove hash from params, sort remaining keys alphabetically
    params.delete("hash")
    const sortedKeys = Array.from(params.keys()).sort()

    // Build data-check string
    const dataCheckString = sortedKeys
      .map((key) => `${key}=${params.get(key)}`)
      .join("\n")

    // Compute secret key = HMAC-SHA256(botToken, "WebAppData")
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest()

    // Compute HMAC-SHA256(secretKey, dataCheckString)
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex")

    // Constant-time comparison to prevent timing attacks
    if (computedHash.length !== hash.length) return false
    let result = 0
    for (let i = 0; i < computedHash.length; i++) {
      result |= computedHash.charCodeAt(i) ^ hash.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}

/**
 * Extract user info from Telegram initData
 * Returns parsed user object or null if invalid
 * Kept for future use — may be needed for auto-filling registration fields
 */
function extractTelegramUser(initData: string): {
  id: number
  first_name: string
  username?: string
} | null {
  if (!initData) return null

  try {
    const params = parseInitData(initData)
    const userJson = params.get("user")
    if (!userJson) return null

    return JSON.parse(decodeURIComponent(userJson))
  } catch {
    return null
  }
}

/**
 * Check auth_date freshness to prevent replay attacks
 * initData is valid for a limited time (we use 24 hours)
 */
export function isInitDataFresh(initData: string, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean {
  if (!initData) return false

  try {
    const params = parseInitData(initData)
    const authDate = params.get("auth_date")
    if (!authDate) return false

    const authTimestamp = parseInt(authDate, 10)
    if (isNaN(authTimestamp)) return false

    const now = Math.floor(Date.now() / 1000)
    return (now - authTimestamp) * 1000 < maxAgeMs
  } catch {
    return false
  }
}
