import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAdmin, logAdminAction } from "@/lib/admin-helpers"

// POST /api/admin/daily/bulk — Bulk schedule dares and/or hot takes
// Body: { dares: [{ text, category, date }[], hotTakes: [{ question, option_a, option_b, date }[]] }
export async function POST(request: NextRequest) {
  const adminCheck = await checkAdmin()
  if ('error' in adminCheck) return adminCheck.error

  const body = await request.json()
  const { dares, hotTakes } = body

  const results = { daresCreated: 0, daresSkipped: 0, hotTakesCreated: 0, hotTakesSkipped: 0, errors: [] as string[] }

  // Bulk create dares
  if (Array.isArray(dares)) {
    for (const dare of dares) {
      try {
        if (!dare.text || !dare.category || !dare.date) {
          results.errors.push(`Dare missing fields for date ${dare.date || 'unknown'}`)
          continue
        }
        if (!['social', 'flirty', 'bold', 'chill'].includes(dare.category)) {
          results.errors.push(`Dare invalid category "${dare.category}" for date ${dare.date}`)
          continue
        }
        // Check if dare already exists for this date
        const existing = await db.dailyDare.findUnique({ where: { date: dare.date } })
        if (existing) {
          results.daresSkipped++
          continue
        }
        await db.dailyDare.create({
          data: { text: dare.text.trim(), category: dare.category, date: dare.date },
        })
        results.daresCreated++
      } catch (err) {
        results.errors.push(`Dare error for ${dare.date}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  // Bulk create hot takes
  if (Array.isArray(hotTakes)) {
    for (const ht of hotTakes) {
      try {
        if (!ht.question || !ht.option_a || !ht.option_b || !ht.date) {
          results.errors.push(`Hot take missing fields for date ${ht.date || 'unknown'}`)
          continue
        }
        // Check if hot take already exists for this date
        const existing = await db.hotTake.findUnique({ where: { date: ht.date } })
        if (existing) {
          results.hotTakesSkipped++
          continue
        }
        await db.hotTake.create({
          data: {
            question: ht.question.trim(),
            option_a: ht.option_a.trim(),
            option_b: ht.option_b.trim(),
            date: ht.date,
          },
        })
        results.hotTakesCreated++
      } catch (err) {
        results.errors.push(`Hot take error for ${ht.date}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  await logAdminAction({
    admin_id: adminCheck.user.id,
    action: "bulk_schedule_daily",
    target_type: "DailyEngagement",
    target_id: "bulk",
    details: { daresCreated: results.daresCreated, hotTakesCreated: results.hotTakesCreated },
  })

  return NextResponse.json({ ok: true, results })
}
