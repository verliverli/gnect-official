import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

// POST /api/group/[roomId]/leave — Leave a group room
// - Auth required
// - Deletes the GroupMember record
// - User's past messages remain (with anonymous_name snapshot)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const { roomId } = await params
    if (!roomId) {
      return NextResponse.json({ ok: false, error: "roomId is required" }, { status: 400 })
    }

    // ===== 1. Check membership exists =====
    const membership = await db.groupMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      select: { id: true, anonymous_name: true },
    })

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "You are not a member of this room" },
        { status: 404 }
      )
    }

    // ===== 2. Delete the membership =====
    await db.groupMember.delete({
      where: { id: membership.id },
    })

    return NextResponse.json({
      ok: true,
      data: { room_id: roomId, anonymous_name: membership.anonymous_name },
    })
  } catch (error) {
    console.error("Group leave error:", error)
    return NextResponse.json({ ok: false, error: "Failed to leave room" }, { status: 500 })
  }
}
