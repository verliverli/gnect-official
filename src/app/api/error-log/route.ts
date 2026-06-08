// ============================================
// POST /api/error-log — Log client-side error (PUBLIC, no auth required)
// Phase 9: Client-side error tracking with deduplication
// Rate limit: 10 per minute per IP
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { simpleHash } from '@/lib/admin-helpers'

// In-memory rate limiting per IP
const ipRateMap = new Map<string, { count: number; resetAt: number }>()

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipRateMap.get(ip)

  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= 10) {
    return false
  }

  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    if (!checkIpRateLimit(ip)) {
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded: 10 per minute' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { message, type, stack_trace, screen, user_agent } = body as {
      message: string
      type: string
      stack_trace?: string
      screen?: string
      user_agent?: string
    }

    // Validate required fields
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'message is required' },
        { status: 400 }
      )
    }
    if (!type || typeof type !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'type is required' },
        { status: 400 }
      )
    }

    // Create error hash from message+type for deduplication
    const error_hash = simpleHash(`${message}::${type}`)

    // Truncate stack_trace to first 5 lines
    let truncatedStack: string | null = null
    if (stack_trace) {
      const lines = stack_trace.split('\n').slice(0, 5)
      truncatedStack = lines.join('\n')
    }

    // Try to get current user if authenticated (optional)
    let userId: string | null = null
    try {
      const { getCurrentUser } = await import('@/lib/auth')
      const user = await getCurrentUser()
      userId = user?.id || null
    } catch {
      // Not authenticated — that's fine, errors can happen before login
    }

    // Check if error_hash already exists
    const existing = await db.errorLog.findUnique({ where: { error_hash } })

    if (existing) {
      // Increment count + update last_seen_at + update user_id if different
      await db.errorLog.update({
        where: { error_hash },
        data: {
          count: { increment: 1 },
          last_seen_at: new Date(),
          // Only update user_id if current user is different and not null
          ...(userId && userId !== existing.user_id ? { user_id: userId } : {}),
          // Update stack_trace if new one is provided and different
          ...(truncatedStack && !existing.stack_trace ? { stack_trace: truncatedStack } : {}),
        },
      })
    } else {
      // Create new ErrorLog entry
      await db.errorLog.create({
        data: {
          error_hash,
          message,
          type,
          stack_trace: truncatedStack,
          screen: screen || null,
          user_id: userId,
          user_agent: user_agent ? user_agent.slice(0, 500) : null,
          count: 1,
          first_seen_at: new Date(),
          last_seen_at: new Date(),
        },
      })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('Error log submission error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
