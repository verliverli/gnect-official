// ============================================
// GNECT RATING API — 5-Star Hotel Style
// POST /api/ratings — Create or update a rating
// GET /api/ratings?userId=xxx — Get rating for a specific user (from current user's perspective)
// ============================================

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// POST — Rate a user (1-5 stars). Only allowed if you have a chat with them.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })

    const body = await request.json()
    const { ratedUserId, stars } = body

    if (!ratedUserId || typeof ratedUserId !== "string") {
      return NextResponse.json({ ok: false, error: "ratedUserId is required" }, { status: 400 })
    }
    if (!stars || typeof stars !== "number" || stars < 1 || stars > 5 || !Number.isInteger(stars)) {
      return NextResponse.json({ ok: false, error: "Stars must be an integer 1-5" }, { status: 400 })
    }
    if (ratedUserId === user.id) {
      return NextResponse.json({ ok: false, error: "Cannot rate yourself" }, { status: 400 })
    }

    // Verify that the users have a chat together
    const chat = await db.chat.findFirst({
      where: {
        OR: [
          { user1_id: user.id, user2_id: ratedUserId },
          { user1_id: ratedUserId, user2_id: user.id },
        ],
      },
    })
    if (!chat) {
      return NextResponse.json({ ok: false, error: "You can only rate people you have chatted with" }, { status: 403 })
    }

    // Verify both users have exchanged at least 10 messages
    const messageCount = await db.message.count({
      where: {
        chat_id: chat.id,
        is_ghost_deleted: false,
        is_unsent: false,
      },
    })
    if (messageCount < 10) {
      return NextResponse.json({ ok: false, error: "You need at least 10 messages to rate this user" }, { status: 403 })
    }

    // Upsert the rating (one rating per user pair)
    const rating = await db.userRating.upsert({
      where: {
        rater_id_rated_user_id: { rater_id: user.id, rated_user_id: ratedUserId },
      },
      create: {
        rater_id: user.id,
        rated_user_id: ratedUserId,
        stars,
      },
      update: {
        stars,
      },
    })

    // Recalculate the rated user's average rating
    const ratings = await db.userRating.findMany({
      where: { rated_user_id: ratedUserId },
      select: { stars: true },
    })
    const avg = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length : 0
    await db.user.update({
      where: { id: ratedUserId },
      data: { rating_avg: Math.round(avg * 10) / 10, rating_count: ratings.length },
    })

    return NextResponse.json({ ok: true, rating: { stars: rating.stars } })
  } catch (error) {
    console.error("Rating error:", error)
    return NextResponse.json({ ok: false, error: "Failed to rate" }, { status: 500 })
  }
}

// GET — Get current user's rating for a specific user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const ratedUserId = searchParams.get("userId")
    if (!ratedUserId) {
      return NextResponse.json({ ok: false, error: "userId query parameter required" }, { status: 400 })
    }

    const rating = await db.userRating.findUnique({
      where: {
        rater_id_rated_user_id: { rater_id: user.id, rated_user_id: ratedUserId },
      },
      select: { stars: true },
    })

    return NextResponse.json({ ok: true, myRating: rating?.stars ?? null })
  } catch (error) {
    console.error("Rating get error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get rating" }, { status: 500 })
  }
}
