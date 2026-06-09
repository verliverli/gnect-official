import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// GET /api/daily — Get today's dare, hot take, and streak
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0] // "2026-06-09"

    // Update login streak
    const todayDate = new Date(today)
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000)
    let streak = user.login_streak || 0

    if (user.last_login_date) {
      const lastLogin = new Date(user.last_login_date).toISOString().split('T')[0]
      if (lastLogin === today) {
        // Already logged in today — no change
      } else if (lastLogin === yesterdayDate.toISOString().split('T')[0]) {
        // Logged in yesterday — increment streak
        streak += 1
      } else {
        // Streak broken
        streak = 1
      }
    } else {
      streak = 1
    }

    const longestStreak = Math.max(streak, user.longest_streak || 0)

    await db.user.update({
      where: { id: user.id },
      data: {
        login_streak: streak,
        longest_streak: longestStreak,
        last_login_date: todayDate,
      },
    })

    // Get today's dare
    const dare = await db.dailyDare.findUnique({ where: { date: today } })

    // Get today's hot take
    const hotTake = await db.hotTake.findUnique({
      where: { date: today },
      include: {
        votes: {
          where: { user_id: user.id },
          select: { choice: true },
        },
      },
    })

    // Count new users in user's country today
    const todayStart = new Date(today)
    const newUsersToday = await db.user.count({
      where: {
        country: user.country,
        created_at: { gte: todayStart },
        is_admin: false,
      },
    })

    // Online users in country
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000)
    const onlineInCountry = await db.user.count({
      where: {
        country: user.country,
        in_app_at: { gte: twoMinAgo },
        is_admin: false,
      },
    })

    return NextResponse.json({
      ok: true,
      data: {
        dare: dare ? { id: dare.id, text: dare.text, category: dare.category } : null,
        hotTake: hotTake ? {
          id: hotTake.id,
          question: hotTake.question,
          option_a: hotTake.option_a,
          option_b: hotTake.option_b,
          votes_a: hotTake.votes_a,
          votes_b: hotTake.votes_b,
          my_vote: hotTake.votes.length > 0 ? hotTake.votes[0].choice : null,
        } : null,
        streak: {
          current: streak,
          longest: longestStreak,
        },
        pulse: {
          newUsersToday,
          onlineInCountry,
          country: user.country,
        },
      },
    })
  } catch (error) {
    console.error("Daily engagement error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
