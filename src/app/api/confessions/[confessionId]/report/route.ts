import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

const REPORT_REASONS = ["Spam", "Harassment", "Underage", "Illegal", "Other"]

// POST /api/confessions/[confessionId]/report — Report a confession
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
    const { reason } = body

    if (!reason || !REPORT_REASONS.includes(reason)) {
      return NextResponse.json({ ok: false, error: "Invalid reason" }, { status: 400 })
    }

    // Check confession exists
    const confession = await db.confession.findFirst({
      where: { id: confessionId, is_deleted: false },
    })
    if (!confession) {
      return NextResponse.json({ ok: false, error: "Confession not found" }, { status: 404 })
    }

    // Check not already reported
    const existing = await db.confessionReport.findUnique({
      where: {
        confession_id_reporter_id: { confession_id: confessionId, reporter_id: user.id },
      },
    })
    if (existing) {
      return NextResponse.json({ ok: false, error: "Already reported" }, { status: 400 })
    }

    await db.confessionReport.create({
      data: {
        confession_id: confessionId,
        reporter_id: user.id,
        reason,
      },
    })

    // Increment reports count
    await db.confession.update({
      where: { id: confessionId },
      data: { reports_count: { increment: 1 } },
    })

    return NextResponse.json({ ok: true, message: "Report submitted" })
  } catch (error) {
    console.error("Report confession error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}
