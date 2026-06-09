import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/discover/all — Fetch all users in the same country (no region filter, no filters except search)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const search = searchParams.get("search")
    const availability = searchParams.get("availability")
    const cursor = searchParams.get("cursor")
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50)
    const seedParam = searchParams.get("seed")

    // Validate search parameter
    if (search && search.length > 20) {
      return NextResponse.json({ ok: false, error: "Search query too long (max 20 chars)" }, { status: 400 })
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

    // Build where clause — visible users only, exclude self and blocked
    const where: Record<string, unknown> = {
      is_admin: false,
      is_banned: false,
      id: { notIn: [user.id, ...blockedUserIds] },
    }
    // Country = Island — users only see same country
    // Admin users see ALL countries (they manage the platform)
    // Fallback: if no country set, show all users
    if (!user.is_admin && user.country) {
      where.country = user.country
    }

    // Apply nickname search (case-insensitive partial match)
    // SQLite is case-insensitive by default for ASCII, no need for mode option
    if (search) {
      where.nickname = { contains: search }
    }

    // Apply availability filter
    if (availability) {
      where.availability = availability
    }

    // Count total matching users
    const total = await db.user.count({ where })

    // If no results, return early
    if (total === 0) {
      return NextResponse.json({ ok: true, data: [], nextCursor: null, total: 0 })
    }

    // Fetch users sorted by online first, then newest — with cursor-based pagination
    const users = await db.user.findMany({
      where,
      orderBy: [
        { is_online: "desc" },
        { created_at: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

    // Shuffle users within online/offline tiers using seed for variety
    const seed = seedParam ? parseInt(seedParam) : Math.floor(Date.now() / 86400000)

    function seededRandom(s: number): number {
      const x = Math.sin(s) * 10000
      return x - Math.floor(x)
    }

    const onlineUsers = users.filter(u => u.is_online)
    const offlineUsers = users.filter(u => !u.is_online)

    for (let i = onlineUsers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i) * (i + 1))
      ;[onlineUsers[i], onlineUsers[j]] = [onlineUsers[j], onlineUsers[i]]
    }
    for (let i = offlineUsers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i + 1000) * (i + 1))
      ;[offlineUsers[i], offlineUsers[j]] = [offlineUsers[j], offlineUsers[i]]
    }

    // Replace users array with shuffled version
    users.length = 0
    users.push(...onlineUsers, ...offlineUsers)

    // Determine next cursor
    const hasNextPage = users.length > limit
    if (hasNextPage) users.length = limit
    const nextCursor = hasNextPage ? users[users.length - 1].id : null

    // Query saved profiles for the current user to compute is_saved
    const savedProfiles = await db.savedProfile.findMany({
      where: { user_id: user.id, saved_user_id: { in: users.map(u => u.id) } },
      select: { saved_user_id: true },
    })
    const savedIds = new Set(savedProfiles.map(s => s.saved_user_id))

    // Format response data with correct is_saved
    const data = users.map((u) => ({
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
      is_saved: savedIds.has(u.id),
      rating_avg: u.rating_avg,
      rating_count: u.rating_count,
    }))

    return NextResponse.json({ ok: true, data, nextCursor, total })
  } catch (error) {
    console.error("Discover all error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
