import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAdmin, logAdminAction } from "@/lib/admin-helpers"

// GET /api/admin/daily/hot-take — List all hot takes (paginated)
export async function GET(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100)
  const cursor = searchParams.get("cursor")

  const hotTakes = await db.hotTake.findMany({
    orderBy: { date: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      _count: { select: { votes: true } },
    },
  })

  const hasNextPage = hotTakes.length > limit
  if (hasNextPage) hotTakes.length = limit
  const nextCursor = hasNextPage ? hotTakes[hotTakes.length - 1].id : null

  // Add total votes count
  const data = hotTakes.map((ht) => ({
    id: ht.id,
    question: ht.question,
    option_a: ht.option_a,
    option_b: ht.option_b,
    votes_a: ht.votes_a,
    votes_b: ht.votes_b,
    total_votes: ht.votes_a + ht.votes_b,
    date: ht.date,
    created_at: ht.created_at,
  }))

  return NextResponse.json({ ok: true, data, nextCursor })
}

// POST /api/admin/daily/hot-take — Create a new hot take for a specific date
export async function POST(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const body = await request.json()
  const { question, option_a, option_b, date } = body

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Question is required" }, { status: 400 })
  }
  if (!option_a || typeof option_a !== 'string' || option_a.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Option A is required" }, { status: 400 })
  }
  if (!option_b || typeof option_b !== 'string' || option_b.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Option B is required" }, { status: 400 })
  }
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Date must be YYYY-MM-DD format" }, { status: 400 })
  }

  // Check if a hot take already exists for this date
  const existing = await db.hotTake.findUnique({ where: { date } })
  if (existing) {
    return NextResponse.json({ ok: false, error: `A hot take already exists for ${date}. Use PUT to update it.` }, { status: 409 })
  }

  const hotTake = await db.hotTake.create({
    data: {
      question: question.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      date,
    },
  })

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "create_hot_take",
    target_type: "HotTake",
    target_id: hotTake.id,
    details: { question: question.trim(), option_a: option_a.trim(), option_b: option_b.trim(), date },
  })

  return NextResponse.json({ ok: true, hotTake })
}

// PUT /api/admin/daily/hot-take — Update an existing hot take by date
export async function PUT(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const body = await request.json()
  const { date, question, option_a, option_b } = body

  if (!date || typeof date !== 'string') {
    return NextResponse.json({ ok: false, error: "Date is required" }, { status: 400 })
  }

  const existing = await db.hotTake.findUnique({ where: { date } })
  if (!existing) {
    return NextResponse.json({ ok: false, error: `No hot take found for ${date}` }, { status: 404 })
  }

  const hotTake = await db.hotTake.update({
    where: { date },
    data: {
      ...(question ? { question: question.trim() } : {}),
      ...(option_a ? { option_a: option_a.trim() } : {}),
      ...(option_b ? { option_b: option_b.trim() } : {}),
    },
  })

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "update_hot_take",
    target_type: "HotTake",
    target_id: hotTake.id,
    details: { date, question, option_a, option_b },
  })

  return NextResponse.json({ ok: true, hotTake })
}
