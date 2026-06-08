// ============================================
// GNECT ADMIN HELPER UTILITIES
// Shared functions for Phase 9 Admin Panel API routes
// ============================================

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// Type for admin user returned by checkAdmin
type AdminUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/**
 * Verify the current user is an admin.
 * Returns the user object if admin, or a NextResponse error if not.
 */
export async function checkAdmin(): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!user.is_admin) {
    return { error: NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 }) }
  }
  return { user }
}

/**
 * Log an admin action to the audit trail.
 */
export async function logAdminAction(params: {
  admin_id: string
  action: string
  target_type: string
  target_id: string
  details?: Record<string, unknown>
}) {
  await db.adminActionLog.create({
    data: {
      admin_id: params.admin_id,
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  })
}

/**
 * Create a simple hash from a string (for error_hash)
 * Uses a basic hash function since we don't need crypto-level security
 */
export function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}
