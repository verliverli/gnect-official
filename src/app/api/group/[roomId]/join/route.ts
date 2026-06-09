import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { generateUniqueAnonymousName } from "@/lib/group-helpers"

// POST /api/group/[roomId]/join — Join a group room
// - Checks room exists and is in user's country
// - Generates a unique anonymous name for the room
// - Creates GroupMember record
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

    // ===== 1. Verify room exists and belongs to user's country =====
    const room = await db.groupRoom.findUnique({
      where: { id: roomId },
      select: { id: true, country: true, name: true },
    })

    if (!room) {
      return NextResponse.json({ ok: false, error: "Room not found" }, { status: 404 })
    }

    if (room.country !== user.country) {
      return NextResponse.json(
        { ok: false, error: "This room is not available in your country" },
        { status: 403 }
      )
    }

    // ===== 2. Check if already a member =====
    const existingMembership = await db.groupMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
    })

    if (existingMembership) {
      // Already a member — return existing info
      return NextResponse.json({
        ok: true,
        data: {
          room_id: existingMembership.room_id,
          anonymous_name: existingMembership.anonymous_name,
          joined_at: existingMembership.joined_at,
        },
      })
    }

    // ===== 3. Generate unique anonymous name and create membership =====
    const anonymousName = await generateUniqueAnonymousName(roomId)

    const membership = await db.groupMember.create({
      data: {
        room_id: roomId,
        user_id: user.id,
        anonymous_name: anonymousName,
      },
      select: {
        room_id: true,
        anonymous_name: true,
        joined_at: true,
      },
    })

    return NextResponse.json({ ok: true, data: membership })
  } catch (error) {
    console.error("Group join error:", error)
    return NextResponse.json({ ok: false, error: "Failed to join room" }, { status: 500 })
  }
}
