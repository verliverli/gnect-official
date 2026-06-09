import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { containsLink } from "@/lib/constants"

// POST /api/group/[roomId]/send — Send a message to a group room
// - Auth required + verify membership
// - Only text content or voice_note media_type. NO PHOTOS.
// - Sets hard_delete_at = 7 days from now
// - Snapshots sender's anonymous name at send time
// - Updates room's last_message_at
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

    // ===== 1. Verify user is a member of the room =====
    const membership = await db.groupMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      select: { anonymous_name: true },
    })

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "You are not a member of this room" },
        { status: 403 }
      )
    }

    // ===== 2. Parse and validate request body =====
    let body: {
      content?: string
      media_url?: string
      media_type?: string
      reply_to_id?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 })
    }

    const { content, media_url, media_type, reply_to_id } = body

    // Either content or media_url must be provided
    if (!content && !media_url) {
      return NextResponse.json(
        { ok: false, error: "Either content or media_url must be provided" },
        { status: 400 }
      )
    }

    // Validate content
    if (content && typeof content !== "string") {
      return NextResponse.json({ ok: false, error: "Content must be a string" }, { status: 400 })
    }

    if (content && content.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "Content must be 2000 characters or less" },
        { status: 400 }
      )
    }

    // Block links in text content (skip for voice notes — content is duration)
    if (containsLink(content) && media_type !== "voice_note") {
      return NextResponse.json(
        { ok: false, error: "Links are not allowed in messages" },
        { status: 400 }
      )
    }

    // ===== 3. Enforce media restrictions — NO PHOTOS in group chat =====
    if (media_type && media_type !== "voice_note") {
      return NextResponse.json(
        { ok: false, error: "Only text and voice notes are allowed in group chat. No photos." },
        { status: 400 }
      )
    }

    // If media_url is provided, media_type must be voice_note
    if (media_url && media_type !== "voice_note") {
      return NextResponse.json(
        { ok: false, error: "Only voice notes are allowed as media in group chat" },
        { status: 400 }
      )
    }

    // ===== 4. Validate reply_to_id if provided =====
    if (reply_to_id) {
      const replyMessage = await db.groupMessage.findUnique({
        where: { id: reply_to_id },
        select: { id: true, room_id: true },
      })
      if (!replyMessage || replyMessage.room_id !== roomId) {
        return NextResponse.json(
          { ok: false, error: "Reply-to message not found in this room" },
          { status: 400 }
        )
      }
    }

    // ===== 5. Create the message =====
    const now = new Date()
    const hardDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const message = await db.groupMessage.create({
      data: {
        room_id: roomId,
        sender_id: user.id,
        anonymous_name: membership.anonymous_name, // Snapshot at send time
        content: content || null,
        media_url: media_url || null,
        media_type: media_type || null,
        reply_to_id: reply_to_id || null,
        hard_delete_at: hardDeleteAt,
      },
      select: {
        id: true,
        sender_id: true,
        anonymous_name: true,
        content: true,
        media_url: true,
        media_type: true,
        reply_to_id: true,
        sent_at: true,
        hard_delete_at: true,
      },
    })

    // ===== 6. Update room's last_message_at =====
    await db.groupRoom.update({
      where: { id: roomId },
      data: { last_message_at: now },
    })

    return NextResponse.json({ ok: true, data: message })
  } catch (error) {
    console.error("Group send error:", error)
    return NextResponse.json({ ok: false, error: "Failed to send message" }, { status: 500 })
  }
}
