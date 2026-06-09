import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// POST /api/daily/hot-take/vote — Vote on today's hot take
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { hot_take_id, choice } = body

    if (!hot_take_id || !choice || !['a', 'b'].includes(choice)) {
      return NextResponse.json({ ok: false, error: "Invalid vote — need hot_take_id and choice (a/b)" }, { status: 400 })
    }

    // Check hot take exists
    const hotTake = await db.hotTake.findUnique({ where: { id: hot_take_id } })
    if (!hotTake) {
      return NextResponse.json({ ok: false, error: "Hot take not found" }, { status: 404 })
    }

    // Check not already voted
    const existing = await db.hotTakeVote.findUnique({
      where: {
        hot_take_id_user_id: { hot_take_id, user_id: user.id },
      },
    })
    if (existing) {
      return NextResponse.json({ ok: false, error: "Already voted" }, { status: 400 })
    }

    // Create vote and update counts
    await db.hotTakeVote.create({
      data: {
        hot_take_id,
        user_id: user.id,
        choice,
      },
    })

    const updateData = choice === 'a'
      ? { votes_a: { increment: 1 } }
      : { votes_b: { increment: 1 } }

    await db.hotTake.update({
      where: { id: hot_take_id },
      data: updateData,
    })

    return NextResponse.json({ ok: true, message: "Vote recorded" })
  } catch (error) {
    console.error("Hot take vote error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
