import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { roomNameFromRegion, generateUniqueAnonymousName } from "@/lib/group-helpers"

// GET /api/group/rooms — List group rooms for the user's region
// - Auto-creates the room for the user's region if it doesn't exist (lazy creation)
// - Auto-joins the user's own region room if not already a member
// - Returns ONLY the user's own region room (1 room per region)
//   and the user's membership info (anonymous name per room)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const country = user.country
    const region = user.region || '' // Default to empty string if undefined

    // ===== 1. Handle region change: leave old rooms, join new region =====
    // Find all rooms the user is a member of
    const existingMemberships = await db.groupMember.findMany({
      where: { user_id: user.id },
      select: {
        room_id: true,
        room: { select: { region: true, country: true } },
      },
    })

    // Leave rooms that don't match the user's current region
    for (const membership of existingMemberships) {
      if (membership.room.region !== region || membership.room.country !== country) {
        await db.groupMember.delete({
          where: { room_id_user_id: { room_id: membership.room_id, user_id: user.id } },
        })
      }
    }

    // ===== 2. Lazy-create the room for the user's own region =====
    let ownRoom = await db.groupRoom.findUnique({
      where: { country_region: { country, region } },
    })

    if (!ownRoom) {
      ownRoom = await db.groupRoom.create({
        data: {
          country,
          region,
          name: roomNameFromRegion(region),
        },
      })
    }

    // ===== 3. Auto-join user to their own region room =====
    const existingMembership = await db.groupMember.findUnique({
      where: { room_id_user_id: { room_id: ownRoom.id, user_id: user.id } },
    })

    if (!existingMembership) {
      const anonymousName = await generateUniqueAnonymousName(ownRoom.id)
      await db.groupMember.create({
        data: {
          room_id: ownRoom.id,
          user_id: user.id,
          anonymous_name: anonymousName,
        },
      })
    }

    // ===== 4. Fetch only the user's own region room =====
    // Each user only sees and chats in their own region's room
    const room = await db.groupRoom.findUnique({
      where: { id: ownRoom.id },
      select: {
        id: true,
        country: true,
        region: true,
        name: true,
        last_message_at: true,
        created_at: true,
        members: {
          select: {
            user_id: true,
            anonymous_name: true,
            last_read_at: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { sent_at: "desc" },
          where: { is_unsent: false },
          select: {
            id: true,
            anonymous_name: true,
            content: true,
            media_type: true,
            sent_at: true,
          },
        },
      },
    })

    if (!room) {
      return NextResponse.json({ ok: true, data: [] })
    }

    // ===== 5. Build response with membership info =====
    const myMembership = room.members.find((m) => m.user_id === user.id)

    const membership = myMembership
      ? {
          anonymous_name: myMembership.anonymous_name,
          last_read_at: myMembership.last_read_at,
        }
      : null

    const lastMessage = room.messages[0]
      ? {
          id: room.messages[0].id,
          anonymous_name: room.messages[0].anonymous_name,
          content: room.messages[0].content,
          media_type: room.messages[0].media_type,
          sent_at: room.messages[0].sent_at,
        }
      : null

    const data = [{
      id: room.id,
      country: room.country,
      region: room.region,
      name: room.name,
      memberCount: room.members.length,
      lastMessage,
      last_message_at: room.last_message_at,
      membership,
    }]

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("Group rooms error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get group rooms" }, { status: 500 })
  }
}
