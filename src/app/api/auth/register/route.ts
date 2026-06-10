import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth"
import { validateNickname, isBotNickname, validatePassword, validateAge, validateCountry } from "@/lib/validation"
import { validateRegion, validateRole } from "@/lib/validation"
import { RATE_LIMITS } from "@/lib/constants"
import { checkIPRegistrationLimit, recordIPRegistration } from "@/lib/rate-limit"
import { notifyAdmins } from "@/lib/notifications"
import { checkGeoAndVPN } from "@/lib/geo-check"

// Read admin credentials from environment variables only (never hardcode)
const ADMIN_NICKNAME = process.env.ADMIN_NICKNAME || ""
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""

// Constant-time string comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid leaking length info via timing
    let result = 0
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length)
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

function isAdminCredentials(nickname: string, password: string): boolean {
  if (!ADMIN_NICKNAME || !ADMIN_PASSWORD) return false
  return constantTimeCompare(nickname, ADMIN_NICKNAME) && constantTimeCompare(password, ADMIN_PASSWORD)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nickname, password, age, country, region, role, street, cucumber_size, show_cucumber, website, startTime } = body

    // ===== SECURITY GATE 1: Geo-block + VPN detection =====
    // Admin registration bypasses geo-check
    const isAdminAttempt = nickname && password && constantTimeCompare(nickname, ADMIN_NICKNAME) && constantTimeCompare(password, ADMIN_PASSWORD)

    if (!isAdminAttempt) {
      const geoResult = await checkGeoAndVPN(request)

      if (!geoResult.allowed) {
        return NextResponse.json({
          ok: false,
          error: geoResult.reason,
          blocked: geoResult.isVPN ? "vpn_detected" : "country_blocked",
          detectedCountry: geoResult.country,
        }, { status: geoResult.isVPN ? 400 : 403 })
      }
    }

    // Honeypot check — silently reject bots
    if (website) {
      return NextResponse.json({ ok: true, user: null })
    }

    // Timing check — reject if submitted under 2 seconds
    if (startTime && typeof startTime === "number") {
      const elapsed = Date.now() - startTime
      if (elapsed < RATE_LIMITS.MIN_REGISTER_TIME_MS) {
        return NextResponse.json({ ok: true, user: null })
      }
    }

    // Validate nickname (unified validation)
    if (!nickname || typeof nickname !== "string") {
      return NextResponse.json({ ok: false, error: "Nickname is required" }, { status: 400 })
    }
    const nickValidation = validateNickname(nickname)
    if (!nickValidation.valid) {
      return NextResponse.json({ ok: false, error: nickValidation.error }, { status: 400 })
    }
    if (isBotNickname(nickname)) {
      return NextResponse.json({ ok: false, error: "Nickname not allowed" }, { status: 400 })
    }

    // Validate password
    const passValidation = validatePassword(password)
    if (!passValidation.valid) {
      return NextResponse.json({ ok: false, error: passValidation.error }, { status: 400 })
    }

    // Validate age
    if (!age || typeof age !== "number") {
      return NextResponse.json({ ok: false, error: "Age is required" }, { status: 400 })
    }
    const ageValidation = validateAge(age)
    if (!ageValidation.valid) {
      return NextResponse.json({ ok: false, error: ageValidation.error }, { status: 400 })
    }

    // Validate country
    if (!country || !validateCountry(country)) {
      return NextResponse.json({ ok: false, error: "Country is required" }, { status: 400 })
    }

    // Validate region
    if (!region || !validateRegion(region)) {
      return NextResponse.json({ ok: false, error: "Invalid region" }, { status: 400 })
    }

    // Validate role
    if (!role || !validateRole(role)) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 })
    }

    // IP rate limit — extract first IP from x-forwarded-for
    const rawIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const ip = rawIp.split(",")[0].trim()
    const ipAllowed = await checkIPRegistrationLimit(ip)
    if (!ipAllowed) {
      return NextResponse.json({ ok: false, error: "Too many registrations from this device" }, { status: 429 })
    }

    // Nickname uniqueness
    const existing = await db.user.findUnique({ where: { nickname } })
    if (existing) {
      return NextResponse.json({ ok: false, error: "Nickname already taken" }, { status: 409 })
    }

    // Validate optional fields
    let safeStreet: string | undefined
    if (street && typeof street === "string") {
      safeStreet = street.trim().slice(0, 30) || undefined
    }

    let safeCucumberSize: number | undefined
    if (cucumber_size && typeof cucumber_size === "number") {
      if (cucumber_size >= 1 && cucumber_size <= 15) {
        safeCucumberSize = cucumber_size
      }
    }

    const safeShowCucumber = typeof show_cucumber === "boolean" ? show_cucumber : false

    // Check if this is an admin registration (admin auto-created on first register with admin credentials)
    const isAdmin = isAdminCredentials(nickname, password)

    // Hash password and create user
    const password_hash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        nickname,
        password_hash,
        age: isAdmin ? 0 : age,           // Admin has no profile — age 0 signals "no age"
        country: isAdmin ? "" : country,   // Country = Island — set ONCE, never changeable
        region: isAdmin ? "" : region,      // Admin has no region
        role: isAdmin ? "" : role,          // Admin has no role per worklog
        is_admin: isAdmin,
        is_early_adopter: isAdmin ? true : false,
        is_premium_free: isAdmin ? true : false,
        ...(isAdmin ? {} : { // Admin doesn't get street/cucumber
          ...(safeStreet ? { street: safeStreet } : {}),
          ...(safeCucumberSize ? { cucumber_size: safeCucumberSize } : {}),
          show_cucumber: safeShowCucumber,
        }),
      },
    })

    // Initialize AppSettings if not exists (needed for admin registration)
    const settings = await db.appSettings.findUnique({ where: { id: "app_settings" } })
    if (!settings) {
      await db.appSettings.create({ data: { id: "app_settings", is_premium_free: true } })
    }

    // If admin registration, skip early adopter check
    if (!isAdmin) {
      // Record IP registration
      await recordIPRegistration(ip)

      // Check early adopter status (atomic increment to avoid race condition)
      const isEarlyAdopter = await db.appSettings.update({
        where: { id: "app_settings" },
        data: { early_adopter_count: { increment: 1 } },
        select: { early_adopter_count: true, max_early_adopters: true },
      })

      if (isEarlyAdopter.early_adopter_count <= isEarlyAdopter.max_early_adopters) {
        await db.user.update({ where: { id: user.id }, data: { is_early_adopter: true } })
      }
    }

    // Create session
    const token = await createSessionToken(user.id)
    await setSessionCookie(token)

    // Notify admins of new registration (non-blocking, skip for admin self-registration)
    if (!isAdmin) {
      notifyAdmins({
        type: 'admin_event',
        title: 'New User Registered',
        body: `${nickname} (${age}yr, ${country}/${region}) just signed up`,
        data: { eventType: 'new_registration', userId: user.id },
      }).catch(() => {})
    }

    // Return user without password_hash + token for PWA
    const { password_hash: _ph, ...safeUser } = user
    return NextResponse.json({
      ok: true,
      user: safeUser,
      token, // PWA may not persist httpOnly cookies — frontend stores in localStorage
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ ok: false, error: "Registration failed" }, { status: 500 })
  }
}
