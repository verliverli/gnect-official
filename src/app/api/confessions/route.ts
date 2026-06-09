import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { CONFESSION_CATEGORIES, CONFESSION_AUTO_DELETE_DAYS, generateAnonymousAlias } from "@/lib/constants"

// POST /api/confessions — Create a new anonymous confession
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    if (user.is_banned || user.is_banned_posting) {
      return NextResponse.json({ ok: false, error: "Account restricted" }, { status: 403 })
    }

    const body = await request.json()
    const { content, category } = body

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "Content is required" }, { status: 400 })
    }
    if (content.length > 1000) {
      return NextResponse.json({ ok: false, error: "Confession too long (max 1000 chars)" }, { status: 400 })
    }

    // Validate category
    const validCategories = CONFESSION_CATEGORIES.map(c => c.id)
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 })
    }

    // Rate limit: max 5 confessions per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await db.confession.count({
      where: {
        user_id: user.id,
        created_at: { gte: oneHourAgo },
      },
    })
    if (recentCount >= 5) {
      return NextResponse.json({ ok: false, error: "Slow down — max 5 confessions per hour" }, { status: 429 })
    }

    // Generate anonymous alias
    const anonymous_alias = generateAnonymousAlias()

    // Auto-delete after 7 days
    const autoDeleteAt = new Date(Date.now() + CONFESSION_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000)

    const confession = await db.confession.create({
      data: {
        user_id: user.id,
        content: content.trim(),
        category,
        anonymous_alias,
        country: user.country,
        auto_delete_at: autoDeleteAt,
      },
    })

    return NextResponse.json({
      ok: true,
      confession: {
        id: confession.id,
        anonymous_alias: confession.anonymous_alias,
        category: confession.category,
        content: confession.content,
        country: confession.country,
        auto_delete_at: confession.auto_delete_at,
        created_at: confession.created_at,
      },
    })
  } catch (error) {
    console.error("Create confession error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/confessions — List confessions (country-filtered)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const cursor = searchParams.get("cursor")
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50)

    // Build where clause
    const where: Record<string, unknown> = {
      is_deleted: false,
    }

    // Country filter: non-admin sees own country only
    if (!user.is_admin && user.country) {
      where.country = user.country
    }

    // Category filter
    if (category) {
      where.category = category
    }

    const confessions = await db.confession.findMany({
      where,
      orderBy: [
        { is_pinned: "desc" },
        { created_at: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        anonymous_alias: true,
        content: true,
        category: true,
        country: true,
        reactions_summary: true,
        total_reactions: true,
        is_pinned: true,
        auto_delete_at: true,
        created_at: true,
        reactions: {
          where: { user_id: user.id },
          select: { emoji: true },
        },
      },
    })

    const hasNextPage = confessions.length > limit
    if (hasNextPage) confessions.length = limit
    const nextCursor = hasNextPage ? confessions[confessions.length - 1].id : null

    // Format response — add user's reaction
    const data = confessions.map((c) => ({
      ...c,
      my_reaction: c.reactions.length > 0 ? c.reactions[0].emoji : null,
      reactions: undefined,
    }))

    return NextResponse.json({ ok: true, data, nextCursor })
  } catch (error) {
    console.error("List confessions error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
