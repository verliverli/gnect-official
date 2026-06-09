import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAdmin, logAdminAction } from "@/lib/admin-helpers"

// GET /api/admin/daily/dare — List all dares (paginated)
export async function GET(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100)
  const cursor = searchParams.get("cursor")

  const dares = await db.dailyDare.findMany({
    orderBy: { date: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasNextPage = dares.length > limit
  if (hasNextPage) dares.length = limit
  const nextCursor = hasNextPage ? dares[dares.length - 1].id : null

  return NextResponse.json({ ok: true, data: dares, nextCursor })
}

// POST /api/admin/daily/dare — Create a new dare for a specific date
export async function POST(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const body = await request.json()
  const { text, category, date } = body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Dare text is required" }, { status: 400 })
  }
  if (!category || !['social', 'flirty', 'bold', 'chill'].includes(category)) {
    return NextResponse.json({ ok: false, error: "Category must be: social, flirty, bold, or chill" }, { status: 400 })
  }
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Date must be YYYY-MM-DD format" }, { status: 400 })
  }

  // Check if a dare already exists for this date
  const existing = await db.dailyDare.findUnique({ where: { date } })
  if (existing) {
    return NextResponse.json({ ok: false, error: `A dare already exists for ${date}. Use PUT to update it.` }, { status: 409 })
  }

  const dare = await db.dailyDare.create({
    data: { text: text.trim(), category, date },
  })

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "create_dare",
    target_type: "DailyDare",
    target_id: dare.id,
    details: { text: text.trim(), category, date },
  })

  return NextResponse.json({ ok: true, dare })
}

// PUT /api/admin/daily/dare — Update an existing dare by date
export async function PUT(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const body = await request.json()
  const { date, text, category } = body

  if (!date || typeof date !== 'string') {
    return NextResponse.json({ ok: false, error: "Date is required" }, { status: 400 })
  }

  const existing = await db.dailyDare.findUnique({ where: { date } })
  if (!existing) {
    return NextResponse.json({ ok: false, error: `No dare found for ${date}` }, { status: 404 })
  }

  const dare = await db.dailyDare.update({
    where: { date },
    data: {
      ...(text ? { text: text.trim() } : {}),
      ...(category ? { category } : {}),
    },
  })

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "update_dare",
    target_type: "DailyDare",
    target_id: dare.id,
    details: { date, text, category },
  })

  return NextResponse.json({ ok: true, dare })
}
