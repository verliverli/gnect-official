import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { RATE_LIMITS, isValidRegionForCountry, getRegionsForCountry } from "@/lib/constants"

// PUT /api/profile/update-region — Change user's region within the same country
// Rules: Same country only, 60-day cooldown for free users
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { region } = body

    if (!region || typeof region !== "string") {
      return NextResponse.json({ ok: false, error: "Region is required" }, { status: 400 })
    }

    if (!user.country) {
      return NextResponse.json({ ok: false, error: "No country set on your account" }, { status: 400 })
    }

    // Validate region belongs to user's country
    if (!isValidRegionForCountry(user.country, region)) {
      return NextResponse.json({
        ok: false,
        error: `Invalid region for ${user.country}. Valid regions: ${getRegionsForCountry(user.country).join(", ")}`,
      }, { status: 400 })
    }

    // Same region — no-op
    if (user.region === region) {
      return NextResponse.json({ ok: false, error: "You are already in this region" }, { status: 400 })
    }

    // Check cooldown — 60 days for all users (matching RATE_LIMITS.REGION_CHANGE_FREE_DAYS)
    if (user.region_last_changed) {
      const lastChange = new Date(user.region_last_changed).getTime()
      const cooldownMs = RATE_LIMITS.REGION_CHANGE_FREE_DAYS * 24 * 60 * 60 * 1000
      const timeSinceLastChange = Date.now() - lastChange
      if (timeSinceLastChange < cooldownMs) {
        const daysRemaining = Math.ceil((cooldownMs - timeSinceLastChange) / (24 * 60 * 60 * 1000))
        return NextResponse.json({
          ok: false,
          error: `Region change cooldown active. You can change again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
          daysRemaining,
        }, { status: 429 })
      }
    }

    // Update region
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        region,
        region_last_changed: new Date(),
      },
      select: {
        id: true, nickname: true, age: true, country: true, region: true,
        region_last_changed: true,
      },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error("Region update error:", error)
    return NextResponse.json({ ok: false, error: "Failed to update region" }, { status: 500 })
  }
}
