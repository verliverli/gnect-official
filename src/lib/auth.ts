// ============================================
// GNECT AUTH UTILITIES
// JWT-based session management with jose
// ============================================

import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies, headers } from "next/headers"
import { db } from "./db"

const SALT_ROUNDS = 10
const SESSION_COOKIE_NAME = "gnect_session"
const SESSION_DURATION = "7d"

// Get JWT secret key
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set. This is required for security.")
  }
  return new TextEncoder().encode(secret)
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Verify a password against a hash
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Create a JWT session token
export async function createSessionToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey())
  return token
}

// Verify a JWT session token
export async function verifySessionToken(
  token: string
): Promise<{ userId: string; iat?: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return { userId: payload.userId as string, iat: payload.iat }
  } catch {
    return null
  }
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
}

// Get session token from cookie
export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

// Get session token from cookie OR Authorization header (for Telegram Mini App)
// Telegram WebView doesn't reliably persist httpOnly cookies,
// so we also accept Bearer tokens in the Authorization header.
// This reads from Next.js headers() automatically — no need to pass Request.
export async function getSessionTokenFromRequest(): Promise<string | undefined> {
  // 1. Try cookie first (works for normal browser)
  const cookieToken = await getSessionToken()
  if (cookieToken) return cookieToken

  // 2. Fallback to Authorization header from Next.js headers() (Telegram Mini App)
  try {
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7)
    }
  } catch {
    // headers() may not be available in some contexts
  }

  return undefined
}

// Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

// Get current user from session (returns null if not authenticated)
// Automatically checks both cookie AND Authorization header (for Telegram Mini App)
// No need to pass Request — reads from Next.js headers() internally
export async function getCurrentUser() {
  const token = await getSessionTokenFromRequest()
  if (!token) return null

  const payload = await verifySessionToken(token)
  if (!payload) return null

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      nickname: true,
      age: true,
      country: true,
      region: true,
      bio: true,
      height: true,
      weight: true,
      body_type: true,
      role: true,
      role_last_changed: true,
      region_last_changed: true,
      availability: true,
      discretion_mode: true,
      secret_phrase: true,
      not_today: true,
      not_today_expires: true,
      is_premium: true,
      is_premium_free: true,
      is_early_adopter: true,
      is_admin: true,
      is_banned: true,
      banned_reason: true,
      is_banned_posting: true,
      is_online: true,
      last_seen: true,
      chats_this_week: true,
      chats_week_reset: true,
      not_today_count: true,
      not_today_reset: true,
      street: true,
      cucumber_size: true,
      show_cucumber: true,
      status_text: true,
      status_gradient: true,
      status_expires_at: true,
      status_views: true,
      notification_settings: true,
      rating_avg: true,
      rating_count: true,
      token_invalidated_before: true,
      created_at: true,
    },
  })

  if (!user) return null

  // Banned users should not be authenticated — EXCEPT soft-deleted accounts
  // that are within their 30-day grace period (they need to reach the recovery endpoint)
  if (user.is_banned) {
    // Check if this is a soft-deleted account (has __SOFT_DELETE_PENDING__ marker)
    if (user.banned_reason?.startsWith('__SOFT_DELETE_PENDING__:')) {
      const deadlineStr = user.banned_reason.replace('__SOFT_DELETE_PENDING__:', '')
      const deadline = new Date(deadlineStr)
      if (new Date() <= deadline) {
        // Within grace period — allow through so they can recover
        // The recovery endpoint will handle the actual recovery flow
      } else {
        // Grace period expired — treat as fully banned
        return null
      }
    } else {
      // Regular ban — no access
      return null
    }
  }

  // Check if token was issued before invalidation (logout everywhere)
  if (user.token_invalidated_before) {
    const tokenIat = payload.iat // seconds since epoch
    const invalidatedBefore = Math.floor(user.token_invalidated_before.getTime() / 1000)
    if (tokenIat !== undefined && tokenIat < invalidatedBefore) {
      return null // token was issued before invalidation
    }
  }

  return user
}

// Check if user has premium features
export function hasPremiumAccess(user: {
  is_premium: boolean
  is_premium_free: boolean
  is_early_adopter: boolean
}): boolean {
  return user.is_premium || user.is_premium_free || user.is_early_adopter
}
