import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { ROLES, BODY_TYPES, AVAILABILITY_STATUSES, INTO_TAGS } from "@/lib/constants"

// GET /api/discover/nearby — Fetch users in the same region as the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse and validate query parameters
    const roleParams = searchParams.getAll("role") // supports multiple roles
    const ageMin = Math.max(parseInt(searchParams.get("ageMin") || "18"), 18)
    const ageMax = Math.min(parseInt(searchParams.get("ageMax") || "120"), 120)
    const street = searchParams.get("street")
    const availability = searchParams.get("availability")
    const bodyTypeParams = searchParams.getAll("bodyType") // supports multiple body types
    const tagParam = searchParams.get("tag")
    const sort = searchParams.get("sort") || "nearby"
    const cursor = searchParams.get("cursor")
    const onlineOnly = searchParams.get("onlineOnly") === "true"
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50)
    const offset = parseInt(searchParams.get("offset") || "0")
    const seedParam = searchParams.get("seed")
    const regionParam = searchParams.get("region")
    const search = searchParams.get("search")

    // Validate search parameter
    if (search && search.length > 20) {
      return NextResponse.json({ ok: false, error: "Search query too long (max 20 chars)" }, { status: 400 })
    }

    // Validate role filters
    const validRoles = roleParams.filter((r) => ROLES.includes(r as typeof ROLES[number]))
    // Validate body type filters
    const validBodyTypes = bodyTypeParams.filter((b) => BODY_TYPES.includes(b as typeof BODY_TYPES[number]))
    // Validate availability
    if (availability && !AVAILABILITY_STATUSES.includes(availability as typeof AVAILABILITY_STATUSES[number])) {
      return NextResponse.json({ ok: false, error: "Invalid availability filter" }, { status: 400 })
    }
    if (!["nearby", "available_now", "newest", "online"].includes(sort)) {
      return NextResponse.json({ ok: false, error: "Invalid sort option" }, { status: 400 })
    }
    if (ageMin > ageMax) {
      return NextResponse.json({ ok: false, error: "ageMin cannot exceed ageMax" }, { status: 400 })
    }

    // Get blocked user IDs — users we blocked OR users who blocked us
    const blockedRecords = await db.block.findMany({
      where: {
        OR: [{ blocker_id: user.id }, { blocked_id: user.id }],
      },
      select: { blocker_id: true, blocked_id: true },
    })
    const blockedUserIds = new Set<string>()
    for (const b of blockedRecords) {
      if (b.blocker_id === user.id) blockedUserIds.add(b.blocked_id)
      if (b.blocked_id === user.id) blockedUserIds.add(b.blocker_id)
    }

    // Build base where clause — visible users only
    const where: Record<string, unknown> = {
      is_admin: false,
      is_banned: false,
      not_today: false,
      age: { gte: ageMin, lte: ageMax },
    }
    // STRICT: Nearby ONLY shows users in the EXACT same country AND region
    // Admin users see ALL countries/regions (they manage the platform)
    // Non-admin WITHOUT a region CANNOT see anyone nearby (return empty)
    // If regionParam is provided, show that specific region within the same country
    if (!user.is_admin) {
      if (!user.country) {
        // No country set = cannot see anyone nearby — strict enforcement
        return NextResponse.json({ ok: true, data: [], nextCursor: null, total: 0 })
      }
      where.country = user.country
      if (regionParam) {
        // Filter by specific region within same country
        where.region = regionParam
      } else {
        // Default: same region as user
        if (!user.region) {
          return NextResponse.json({ ok: true, data: [], nextCursor: null, total: 0 })
        }
        where.region = user.region
      }
    } else if (regionParam) {
      // Admin with region filter
      where.region = regionParam
    }

    // Apply optional filters — multiple roles
    if (validRoles.length === 1) {
      where.role = validRoles[0]
    } else if (validRoles.length > 1) {
      where.role = { in: validRoles }
    }

    // Multiple body types
    if (validBodyTypes.length === 1) {
      where.body_type = validBodyTypes[0]
    } else if (validBodyTypes.length > 1) {
      where.body_type = { in: validBodyTypes }
    }

    if (availability) where.availability = availability
    if (street) where.street = street
    if (onlineOnly) where.is_online = true

    // Apply nickname search (case-insensitive partial match)
    if (search) {
      where.nickname = { contains: search }
    }

    // Build excluded IDs (self + blocked users)
    const excludeIds = [user.id, ...blockedUserIds]

    // Tag filter — subquery: find user IDs that have ANY of the specified tags
    if (tagParam) {
      const tags = tagParam
        .split(",")
        .map((t) => t.trim())
        .filter((t) => INTO_TAGS.includes(t as typeof INTO_TAGS[number]))

      if (tags.length > 0) {
        const tagRecords = await db.intoTag.findMany({
          where: { tag: { in: tags } },
          select: { user_id: true },
        })
        const tagUserIds = [...new Set(tagRecords.map((r) => r.user_id))]
        // Combine with exclusion list (self + blocked)
        where.id = { in: tagUserIds.filter((id) => !excludeIds.includes(id)) }
      } else {
        // No valid tags = no results
        where.id = { in: [] }
      }
    } else {
      where.id = { notIn: excludeIds }
    }

    // Count total matching users
    const total = await db.user.count({ where })

    // If no results, return early
    if (total === 0) {
      return NextResponse.json({ ok: true, data: [], nextCursor: null, total: 0 })
    }

    // Fetch matching users — we use in-memory sorting for custom orderings
    // that Prisma cannot express (e.g., "same street first")
    // Overfetch by a small buffer to account for in-memory sorting + cursor pagination
    const allUsers = await db.user.findMany({
      where,
      take: limit + 10,
      skip: offset,
      select: {
        id: true,
        nickname: true,
        age: true,
        region: true,
        role: true,
        body_type: true,
        availability: true,
        is_online: true,
        last_seen: true,
        in_app_at: true,
        street: true,
        cucumber_size: true,
        show_cucumber: true,
        discretion_mode: true,
        status_text: true,
        status_gradient: true,
        created_at: true,
        rating_avg: true,
        rating_count: true,
        photos: {
          select: { id: true, catbox_url: true, is_face_pic: true, is_locked: true },
          orderBy: { upload_order: "asc" },
        },
        into_tags: {
          select: { tag: true },
        },
      },
    })

    // Sort in memory based on sort option
    // ALL sorts prioritize online users first as the primary sort key
    if (sort === "nearby") {
      // Online first → same street → last_seen DESC
      const myStreet = user.street
      allUsers.sort((a, b) => {
        // Online users ALWAYS at top
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        // Then same street first
        const aSame = a.street && myStreet && a.street === myStreet ? 0 : 1
        const bSame = b.street && myStreet && b.street === myStreet ? 0 : 1
        if (aSame !== bSame) return aSame - bSame
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      })
    } else if (sort === "available_now") {
      // Online first → "Available Now" → last_seen DESC
      allUsers.sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        const aAvail = a.availability === "Available Now" ? 0 : 1
        const bAvail = b.availability === "Available Now" ? 0 : 1
        if (aAvail !== bAvail) return aAvail - bAvail
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      })
    } else if (sort === "online") {
      // Online first → last_seen DESC
      allUsers.sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      })
    } else {
      // newest — Online first → created_at DESC
      allUsers.sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    // After the sort, shuffle within tiers (online vs offline) using seed
    const seed = seedParam ? parseInt(seedParam) : Math.floor(Date.now() / 86400000) // Changes daily

    // Simple seeded random for consistent shuffling within a session
    function seededRandom(s: number): number {
      const x = Math.sin(s) * 10000
      return x - Math.floor(x)
    }

    // Group by online status, shuffle within each group, then recombine
    const onlineUsers = allUsers.filter(u => u.is_online)
    const offlineUsers = allUsers.filter(u => !u.is_online)

    // Seeded shuffle
    for (let i = onlineUsers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i) * (i + 1))
      ;[onlineUsers[i], onlineUsers[j]] = [onlineUsers[j], onlineUsers[i]]
    }
    for (let i = offlineUsers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i + 1000) * (i + 1))
      ;[offlineUsers[i], offlineUsers[j]] = [offlineUsers[j], offlineUsers[i]]
    }

    // Recombine: online first, then offline (both shuffled within their group)
    allUsers.length = 0
    allUsers.push(...onlineUsers, ...offlineUsers)

    // Cursor-based pagination — find cursor position and skip past it
    let startIndex = 0
    if (cursor) {
      const cursorIdx = allUsers.findIndex((u) => u.id === cursor)
      if (cursorIdx !== -1) {
        startIndex = cursorIdx + 1
      }
      // If cursor not found, start from beginning (graceful fallback)
    }

    const paginated = allUsers.slice(startIndex, startIndex + limit + 1)
    const hasNextPage = paginated.length > limit
    if (hasNextPage) paginated.length = limit
    const nextCursor = hasNextPage ? paginated[paginated.length - 1].id : null

    // Fetch saved profile status for current user
    const userIds = paginated.map((u) => u.id)
    const savedProfiles =
      userIds.length > 0
        ? await db.savedProfile.findMany({
            where: { user_id: user.id, saved_user_id: { in: userIds } },
            select: { saved_user_id: true },
          })
        : []
    const savedUserIds = new Set(savedProfiles.map((s) => s.saved_user_id))

    // Format response data
    const data = paginated.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      age: u.age,
      region: u.region,
      role: u.role,
      body_type: u.body_type,
      availability: u.availability,
      is_online: u.is_online,
      is_in_app: u.in_app_at ? (Date.now() - new Date(u.in_app_at).getTime() < 2 * 60 * 1000) : false,
      last_seen: u.last_seen,
      street: u.street,
      cucumber_size: u.show_cucumber ? u.cucumber_size : null,
      show_cucumber: u.show_cucumber,
      discretion_mode: u.discretion_mode,
      status_text: u.status_text,
      status_gradient: u.status_gradient,
      created_at: u.created_at,
      photos: u.photos,
      into_tags: u.into_tags.map((t: { tag: string }) => t.tag),
      is_saved: savedUserIds.has(u.id),
      rating_avg: u.rating_avg,
      rating_count: u.rating_count,
    }))

    return NextResponse.json({ ok: true, data, nextCursor, total })
  } catch (error) {
    console.error("Discover nearby error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
