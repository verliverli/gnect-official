import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAdmin, logAdminAction } from "@/lib/admin-helpers"

// DELETE /api/admin/daily/dare/[id] — Delete a dare
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const { id } = await params

  const dare = await db.dailyDare.findUnique({ where: { id } })
  if (!dare) {
    return NextResponse.json({ ok: false, error: "Dare not found" }, { status: 404 })
  }

  await db.dailyDare.delete({ where: { id } })

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "delete_dare",
    target_type: "DailyDare",
    target_id: id,
    details: { date: dare.date, text: dare.text },
  })

  return NextResponse.json({ ok: true })
}
