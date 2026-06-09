import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { CONFESSION_REACTIONS } from "@/lib/constants"

// POST /api/confessions/[confessionId]/react — React to a confession
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ confessionId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { confessionId } = await params
    const body = await request.json()
    const { emoji } = body

    // Validate emoji
    if (!emoji || !CONFESSION_REACTIONS.includes(emoji as any)) {
      return NextResponse.json({ ok: false, error: "Invalid reaction emoji" }, { status: 400 })
    }

    // Check confession exists and not deleted
    const confession = await db.confession.findFirst({
      where: { id: confessionId, is_deleted: false },
    })
    if (!confession) {
      return NextResponse.json({ ok: false, error: "Confession not found" }, { status: 404 })
    }

    // Check existing reaction
    const existing = await db.confessionReaction.findUnique({
      where: {
        confession_id_user_id: { confession_id: confessionId, user_id: user.id },
      },
    })

    // Parse current reactions summary
    let summary: Record<string, number> = {}
    try {
      summary = JSON.parse(confession.reactions_summary || '{}')
    } catch { summary = {} }

    if (existing) {
      if (existing.emoji === emoji) {
        // Remove reaction (toggle off)
        await db.confessionReaction.delete({
          where: { id: existing.id },
        })
        summary[emoji] = Math.max(0, (summary[emoji] || 0) - 1)
        if (summary[emoji] === 0) delete summary[emoji]

        await db.confession.update({
          where: { id: confessionId },
          data: {
            reactions_summary: JSON.stringify(summary),
            total_reactions: Math.max(0, confession.total_reactions - 1),
          },
        })

        return NextResponse.json({ ok: true, action: "removed", reactions_summary: summary })
      } else {
        // Change reaction
        summary[existing.emoji] = Math.max(0, (summary[existing.emoji] || 0) - 1)
        if (summary[existing.emoji] === 0) delete summary[existing.emoji]

        await db.confessionReaction.update({
          where: { id: existing.id },
          data: { emoji },
        })

        summary[emoji] = (summary[emoji] || 0) + 1

        await db.confession.update({
          where: { id: confessionId },
          data: { reactions_summary: JSON.stringify(summary) },
        })

        return NextResponse.json({ ok: true, action: "changed", reactions_summary: summary })
      }
    } else {
      // New reaction
      await db.confessionReaction.create({
        data: {
          confession_id: confessionId,
          user_id: user.id,
          emoji,
        },
      })

      summary[emoji] = (summary[emoji] || 0) + 1

      await db.confession.update({
        where: { id: confessionId },
        data: {
          reactions_summary: JSON.stringify(summary),
          total_reactions: confession.total_reactions + 1,
        },
      })

      return NextResponse.json({ ok: true, action: "added", reactions_summary: summary })
    }
  } catch (error) {
    console.error("React to confession error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
