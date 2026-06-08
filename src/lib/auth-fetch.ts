// ============================================
// GNECT AUTH-AWARE FETCH HELPER
// Automatically includes Authorization header
// with localStorage token for Telegram Mini App
// ============================================

const GNECT_TOKEN_KEY = 'gnect_token'

/**
 * Auth-aware fetch for GNECT API calls.
 * Works in BOTH normal browsers (cookies) AND Telegram Mini App (Authorization header).
 *
 * Usage: Replace `fetch('/api/...')` with `authFetch('/api/...')`
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(GNECT_TOKEN_KEY) : null

  const headers = new Headers(options.headers || {})

  // Add Authorization header if we have a stored token (Telegram Mini App)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Always include credentials for cookies (normal browser)
  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  })
}
