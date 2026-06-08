import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, clearSessionCookie } from '@/lib/auth'
import { db } from '@/lib/db'

// ============================================
// ACCOUNT DELETION — Full Implementation
// Two options: Soft Delete (30-day grace) or Nuclear Self-Destruct (instant)
//
// Soft Delete uses the is_banned + banned_reason mechanism
// already supported in auth.ts (__SOFT_DELETE_PENDING__:DEADLINE)
//
// Nuclear Delete removes ALL data from EVERY table
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Admin accounts cannot be deleted
    if (user.is_admin) {
      return NextResponse.json({ ok: false, error: 'Admin accounts cannot be deleted' }, { status: 403 })
    }

    const body = await request.json()
    const { type, confirmNickname } = body

    if (!type || !['soft', 'nuclear'].includes(type)) {
      return NextResponse.json({ ok: false, error: 'Invalid deletion type. Use "soft" or "nuclear"' }, { status: 400 })
    }

    if (!confirmNickname || confirmNickname !== user.nickname) {
      return NextResponse.json({ ok: false, error: 'Nickname confirmation does not match' }, { status: 400 })
    }

    if (type === 'soft') {
      // ---- SOFT DELETE ----
      // Mark account as banned with __SOFT_DELETE_PENDING__ marker
      // This is already handled by auth.ts — user can still log in during grace period
      // to recover their account. After 30 days, they're fully locked out.
      const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await db.user.update({
        where: { id: user.id },
        data: {
          is_banned: true,
          banned_reason: `__SOFT_DELETE_PENDING__:${deadline.toISOString()}`,
          is_online: false,
          availability: 'Not Now',
          // Invalidate all existing sessions
          token_invalidated_before: new Date(),
        },
      })

      // Clear session cookie
      await clearSessionCookie()

      return NextResponse.json({
        ok: true,
        message: 'Account scheduled for deletion. You have 30 days to recover by logging back in.',
        recoveryDeadline: deadline.toISOString(),
      })
    }

    // ---- NUCLEAR SELF-DESTRUCT ----
    // Delete EVERYTHING from EVERY table — no trace left
    // Increased timeout: many sequential deletes can exceed the default 5s
    await db.$transaction(async (tx) => {
      // 1. Feedback
      await tx.feedback.deleteMany({ where: { user_id: user.id } })

      // 2. Support messages (as sender)
      await tx.supportMessage.deleteMany({ where: { sender_id: user.id } })

      // 3. Support conversations
      await tx.supportConversation.deleteMany({ where: { user_id: user.id } })

      // 4. Broadcast acknowledgements
      await tx.broadcastAck.deleteMany({ where: { user_id: user.id } })

      // 5. Notifications
      await tx.notification.deleteMany({ where: { user_id: user.id } })

      // 6. Push subscriptions
      await tx.pushSubscription.deleteMany({ where: { user_id: user.id } })

      // 7. Ratings given and received
      await tx.userRating.deleteMany({
        where: { OR: [{ rater_id: user.id }, { rated_user_id: user.id }] },
      })

      // 8. Post reports made by user
      await tx.postReport.deleteMany({ where: { reporter_id: user.id } })

      // 9. Post upvotes
      await tx.postUpvote.deleteMany({ where: { user_id: user.id } })

      // 10. Post comments
      await tx.postComment.deleteMany({ where: { user_id: user.id } })

      // 11. Community posts
      await tx.communityPost.deleteMany({ where: { user_id: user.id } })

      // 12. Rate limits
      await tx.rateLimit.deleteMany({ where: { user_id: user.id } })

      // 13. Blocks (both directions)
      await tx.block.deleteMany({
        where: { OR: [{ blocker_id: user.id }, { blocked_id: user.id }] },
      })

      // 14. Reports (both directions)
      await tx.report.deleteMany({
        where: { OR: [{ reporter_id: user.id }, { reported_user_id: user.id }] },
      })

      // 15. Saved profiles (both directions)
      await tx.savedProfile.deleteMany({
        where: { OR: [{ user_id: user.id }, { saved_user_id: user.id }] },
      })

      // 16. Get user's chats — delete messages then chats
      const userChats = await tx.chat.findMany({
        where: { OR: [{ user1_id: user.id }, { user2_id: user.id }] },
        select: { id: true },
      })
      const chatIds = userChats.map((c) => c.id)

      if (chatIds.length > 0) {
        // Delete all messages in those chats
        await tx.message.deleteMany({ where: { chat_id: { in: chatIds } } })
        // Delete the chats themselves
        await tx.chat.deleteMany({ where: { id: { in: chatIds } } })
      }

      // 17. Delete any orphaned messages where user is sender
      // (shouldn't exist after chat deletion, but just in case)
      await tx.message.deleteMany({ where: { sender_id: user.id } })

      // 18. Profile photos
      await tx.profilePhoto.deleteMany({ where: { user_id: user.id } })

      // 19. Into tags
      await tx.intoTag.deleteMany({ where: { user_id: user.id } })

      // 20. Error logs — set user_id to null (don't delete logs, they're useful)
      // Schema has onDelete: SetNull so this happens automatically

      // 21. Admin action logs — only if user was admin (shouldn't happen but safety)
      // Admins can't delete, so skip

      // 22. FINALLY — delete the user record itself
      await tx.user.delete({ where: { id: user.id } })
    }, { timeout: 30000 }) // 30 second timeout — nuclear delete has many sequential operations

    // Clear session cookie
    await clearSessionCookie()

    return NextResponse.json({
      ok: true,
      message: 'Account permanently deleted. All data has been removed.',
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to delete account. Please try again.' }, { status: 500 })
  }
}
