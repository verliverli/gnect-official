import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAdmin, logAdminAction } from "@/lib/admin-helpers"

// DELETE /api/admin/daily/hot-take/[id] — Delete a hot take
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const { id } = await params

  const hotTake = await db.hotTake.findUnique({ where: { id } })
  if (!hotTake) {
    return NextResponse.json({ ok: false, error: "Hot take not found" }, { status: 404 })
  }

  await db.hotTake.delete({ where: { id } })

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "delete_hot_take",
    target_type: "HotTake",
    target_id: id,
    details: { date: hotTake.date, question: hotTake.question },
  })

  return NextResponse.json({ ok: true })
}
