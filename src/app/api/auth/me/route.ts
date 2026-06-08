import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    // getCurrentUser now auto-checks both cookie AND Authorization header
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    // Check if user is banned (getCurrentUser already checks this, but double-check for API response)
    if (user.is_banned) {
      return NextResponse.json({ ok: false, error: "This account has been suspended" }, { status: 403 })
    }

    // NOTE: Removed DB write (update last_seen/is_online) from here.
    // That's now handled by the 30s heartbeat in AppShell — no need to
    // slow down every auth check with a database write on Vercel serverless.

    return NextResponse.json({ ok: true, user })
  } catch (error) {
    console.error("Me error:", error)
    return NextResponse.json({ ok: false, error: "Failed to get user" }, { status: 500 })
  }
}
