// ============================================
// GNECT GEO & VPN DETECTION
// Registration security — country verification + VPN blocking
// findip.net (primary) → Vercel header (fast) → proxycheck.io (backup)
// ============================================

import { NextRequest } from "next/server"

// Target countries — ONLY these are allowed for registration
const TARGET_COUNTRIES: Record<string, string> = {
  PL: "Poland",
  QA: "Qatar",
  AE: "UAE",
  SA: "Saudi Arabia",
}

// Country code to country name mapping (for error messages)
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  PL: "Poland",
  QA: "Qatar",
  AE: "UAE",
  SA: "Saudi Arabia",
}

export interface GeoCheckResult {
  allowed: boolean
  country: string | null
  countryCode: string | null
  isVPN: boolean
  reason?: string
}

/**
 * Step 1: Check Vercel IP country header (instant, free, zero API call)
 * Only works on Vercel deployments
 */
function getVercelCountry(request: NextRequest): string | null {
  return request.headers.get("x-vercel-ip-country")
}

/**
 * Step 2: Query findip.net for IP geolocation (primary API — unlimited free)
 * Returns ISO country code or null
 */
async function getFindIpCountry(ip: string): Promise<string | null> {
  const apiKey = process.env.FINDIP_API_KEY
  if (!apiKey || !ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return null

  try {
    const res = await fetch(`https://api.findip.net/${ip}/?token=${apiKey}`, {
      signal: AbortSignal.timeout(5000), // 5s timeout
    })
    if (!res.ok) return null

    const data = await res.json()
    return data?.country?.iso_code || null
  } catch {
    return null
  }
}

/**
 * Step 3: Query proxycheck.io for VPN/proxy detection (backup — free tier 1K/day)
 * Also returns country code as fallback
 */
async function getProxyCheckResult(ip: string): Promise<{ isVPN: boolean; countryCode: string | null }> {
  const apiKey = process.env.PROXYCHECK_API_KEY
  if (!apiKey || !ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") {
    return { isVPN: false, countryCode: null }
  }

  try {
    const res = await fetch(`https://proxycheck.io/v2/${ip}?key=${apiKey}&vpn=1`, {
      signal: AbortSignal.timeout(5000), // 5s timeout
    })
    if (!res.ok) return { isVPN: false, countryCode: null }

    const data = await res.json()
    if (data.status !== "ok" || !data[ip]) {
      return { isVPN: false, countryCode: null }
    }

    const ipInfo = data[ip]
    return {
      isVPN: ipInfo.proxy === "yes",
      countryCode: ipInfo.isocode || null,
    }
  } catch {
    return { isVPN: false, countryCode: null }
  }
}

/**
 * Extract client IP from request headers
 */
function getClientIP(request: NextRequest): string {
  const rawIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  return rawIp.split(",")[0].trim()
}

/**
 * Main geo-check function for registration
 *
 * Flow:
 * 1. Try Vercel header (instant)
 * 2. If no Vercel header, try findip.net (primary)
 * 3. If findip.net fails, try proxycheck.io (backup, also gives country)
 * 4. If all fail, BLOCK registration (hard block — no fail-open)
 * 5. If country is not in target list, BLOCK
 * 6. Check VPN via proxycheck.io — if VPN detected, BLOCK
 */
export async function checkGeoAndVPN(request: NextRequest): Promise<GeoCheckResult> {
  const ip = getClientIP(request)

  // Step 1: Try Vercel header first (instant, zero API call)
  let countryCode: string | null = getVercelCountry(request)

  // Step 2: If no Vercel header, try findip.net (primary — unlimited free)
  if (!countryCode) {
    countryCode = await getFindIpCountry(ip)
  }

  // Step 3: If findip.net also failed, try proxycheck.io as backup (also returns country)
  if (!countryCode) {
    const proxyResult = await getProxyCheckResult(ip)
    countryCode = proxyResult.countryCode

    // Even if we got country from proxycheck, also check VPN status
    if (countryCode && proxyResult.isVPN) {
      return {
        allowed: false,
        country: COUNTRY_CODE_TO_NAME[countryCode] || null,
        countryCode,
        isVPN: true,
        reason: "VPN/Proxy detected. Please turn off your VPN during registration.",
      }
    }
  }

  // Step 4: If we still have no country, BLOCK — hard block, no fail-open
  if (!countryCode) {
    return {
      allowed: false,
      country: null,
      countryCode: null,
      isVPN: false,
      reason: "Unable to verify your location. Please try again later.",
    }
  }

  // Step 5: Check if country is in target list
  if (!TARGET_COUNTRIES[countryCode]) {
    return {
      allowed: false,
      country: COUNTRY_CODE_TO_NAME[countryCode] || null,
      countryCode,
      isVPN: false,
      reason: "Sorry, GNECT is not available in your country for now.",
    }
  }

  // Step 6: Check VPN — only if we haven't already checked via proxycheck
  const vpnCheck = await getProxyCheckResult(ip)
  if (vpnCheck.isVPN) {
    return {
      allowed: false,
      country: COUNTRY_CODE_TO_NAME[countryCode] || null,
      countryCode,
      isVPN: true,
      reason: "VPN/Proxy detected. Please turn off your VPN during registration.",
    }
  }

  // All checks passed
  return {
    allowed: true,
    country: COUNTRY_CODE_TO_NAME[countryCode] || null,
    countryCode,
    isVPN: false,
  }
}
