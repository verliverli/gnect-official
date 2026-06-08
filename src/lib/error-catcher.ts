// ============================================
// GNECT CLIENT-SIDE ERROR CATCHER
// Phase 9: Silent error logging to backend
// Debounced: same error not sent more than once per 30 seconds
// ============================================

// Global variable to track which screen the error happened on
declare global {
  interface Window {
    __gnectCurrentScreen?: string
  }
}

const DEBOUNCE_MS = 30_000
const sentCache = new Map<string, number>()

function simplifyUserAgent(ua: string): string {
  try {
    let browser = 'Unknown'
    let os = 'Unknown'

    // Browser detection
    if (ua.includes('Firefox/')) browser = 'Firefox'
    else if (ua.includes('Edg/')) browser = 'Edge'
    else if (ua.includes('Chrome/')) browser = 'Chrome'
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'
    else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 'Opera'

    // OS detection
    if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
    else if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac OS')) os = 'macOS'
    else if (ua.includes('Linux')) os = 'Linux'

    return `${browser} on ${os}`
  } catch {
    return ua.slice(0, 100)
  }
}

function classifyError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('net::')) return 'network_error'
  if (msg.includes('socket') || msg.includes('websocket') || msg.includes('io')) return 'socket_error'
  if (msg.includes('api') || msg.includes('status 4') || msg.includes('status 5') || msg.includes('unauthorized') || msg.includes('forbidden')) return 'api_error'
  return 'frontend_crash'
}

async function sendError(payload: {
  message: string
  type: string
  stack_trace?: string
  screen?: string
  user_agent?: string
}) {
  const key = `${payload.message}::${payload.type}`
  const now = Date.now()
  const lastSent = sentCache.get(key)
  if (lastSent && now - lastSent < DEBOUNCE_MS) return

  sentCache.set(key, now)

  try {
    await fetch('/api/error-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    })
  } catch {
    // Silent fail — don't create infinite error loops
  }
}

function handleError(message: string, source?: string, lineno?: number, colno?: number, error?: Error) {
  const type = classifyError(message)
  const stackTrace = error?.stack || (source ? `${source}:${lineno}:${colno}` : undefined)
  const screen = window.__gnectCurrentScreen || undefined

  sendError({
    message: String(message).slice(0, 500),
    type,
    stack_trace: stackTrace?.slice(0, 2000),
    screen,
    user_agent: simplifyUserAgent(navigator.userAgent),
  })
}

export function initErrorCatcher() {
  // Capture window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    handleError(String(message), source ?? undefined, lineno ?? undefined, colno ?? undefined, error ?? undefined)
  }

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const type = classifyError(message)
    const screen = window.__gnectCurrentScreen || undefined

    sendError({
      message: message.slice(0, 500),
      type,
      stack_trace: reason instanceof Error ? reason.stack?.slice(0, 2000) : undefined,
      screen,
      user_agent: simplifyUserAgent(navigator.userAgent),
    })
  })

  // Clean up old entries from sentCache every 5 minutes
  setInterval(() => {
    const now = Date.now()
    for (const [key, timestamp] of sentCache.entries()) {
      if (now - timestamp > DEBOUNCE_MS * 2) {
        sentCache.delete(key)
      }
    }
  }, 300_000)
}
