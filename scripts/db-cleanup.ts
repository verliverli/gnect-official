/**
 * Database Cleanup Script — Wipe all data except admin user
 * Run with: bun run scripts/db-cleanup.ts
 */
import { createClient } from '@libsql/client'

const TURSO_URL = 'https://gnect-verliverli.aws-eu-west-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFQ0RILU5SIiwiY2lkIjoiYzhkNjE3MjUtODI3OC00ZTdlLTk5NjUtMGIyMjJlZjhmM2U0IiwidHBsIjoiZGVmYXVsdCIsInVzIjoiYWRtaW5Ac2FmZXBsYWNlLmlvIn0.eyJncmFudGVlIjoiZ2VuZXJhdGUtdG9rZW4tZm9yLXByb2QtY2RiZTY3M2MtMjA3Mi0xMWVmLWE5YTQtMjJiODA2MDc0YmJlIiwiaXNTdXBlclVzZXIiOmZhbHNlLCJyb3RhdGlvbl9kYXRlIjoiMjAyNi0wMy0wN1QwMDowMDowMFoifQ.9Qv7lFEx6qSWkM1u8qLB7m-JFqg3FVCnDVRHTuV1lUA5Mx5cVR4TfGBHVNu2XhBENa1sH9tJOZn6LK7s3kMqEg'

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

async function main() {
  console.log('🗑️  GNECT Database Cleanup — Wiping all data except admin...\n')

  // Step 1: Find admin user
  const adminResult = await client.execute("SELECT id, nickname, is_admin FROM User WHERE is_admin = 1")
  if (adminResult.rows.length === 0) {
    console.error('❌ NO ADMIN USER FOUND! Aborting to prevent wiping everything.')
    process.exit(1)
  }
  const adminId = String(adminResult.rows[0].id)
  const adminNickname = String(adminResult.rows[0].nickname)
  console.log(`✅ Found admin: ${adminNickname} (${adminId})\n`)

  // Step 2: Get all non-admin user IDs
  const nonAdminResult = await client.execute({ sql: "SELECT id FROM User WHERE id != ?", args: [adminId] })
  const nonAdminIds = nonAdminResult.rows.map(r => String(r.id))
  console.log(`📊 Non-admin users to delete: ${nonAdminIds.length}`)

  if (nonAdminIds.length === 0) {
    console.log('✨ Database is already clean (only admin exists). Nothing to do.')
    process.exit(0)
  }

  // Step 3: Delete all dependent data in correct order (respecting foreign keys)
  // These tables have no foreign key dependencies on each other, just on User
  const independentTables = [
    'BroadcastAck',
    'Notification',
    'PushSubscription',
    'PostReport',
    'PostUpvote',
    'PostComment',
    'CommunityPost',
    'ConfessionReport',
    'ConfessionReaction',
    'Confession',
    'HotTakeVote',
    'HotTake',
    'DailyDare',
    'GroupMessage',
    'GroupMember',
    'GroupRoom',
    'UserRating',
    'SupportMessage',
    'SupportConversation',
    'AdminActionLog',
    'ErrorLog',
    'Feedback',
    'AdminBroadcast',
    'RateLimit',
    'IPRegistration',
    'Block',
    'Report',
    'SavedProfile',
    'IntoTag',
    'ProfilePhoto',
  ]

  // Also tables that depend on Chat
  const chatDependentTables = ['Message']

  // Step 4: Wipe independent tables completely (they have cascade on User delete, but we nuke them all)
  for (const table of independentTables) {
    try {
      const result = await client.execute(`DELETE FROM ${table}`)
      console.log(`  🗑️  ${table}: ${result.rowsAffected} rows deleted`)
    } catch (e: any) {
      console.log(`  ⚠️  ${table}: ${e.message}`)
    }
  }

  // Step 5: Delete messages and chats
  for (const table of chatDependentTables) {
    try {
      const result = await client.execute(`DELETE FROM ${table}`)
      console.log(`  🗑️  ${table}: ${result.rowsAffected} rows deleted`)
    } catch (e: any) {
      console.log(`  ⚠️  ${table}: ${e.message}`)
    }
  }

  // Step 6: Delete all chats
  try {
    const result = await client.execute(`DELETE FROM Chat`)
    console.log(`  🗑️  Chat: ${result.rowsAffected} rows deleted`)
  } catch (e: any) {
    console.log(`  ⚠️  Chat: ${e.message}`)
  }

  // Step 7: Delete all non-admin users
  try {
    const result = await client.execute({ sql: "DELETE FROM User WHERE id != ?", args: [adminId] })
    console.log(`  🗑️  User (non-admin): ${result.rowsAffected} rows deleted`)
  } catch (e: any) {
    console.log(`  ⚠️  User: ${e.message}`)
  }

  // Step 8: Reset admin user's relational data (keep the user row clean)
  try {
    await client.execute({
      sql: `UPDATE User SET
        is_online = 0,
        in_app_at = NULL,
        status_text = NULL,
        status_gradient = NULL,
        status_expires_at = NULL,
        status_views = 0,
        not_today = 0,
        not_today_expires = NULL
      WHERE id = ?`,
      args: [adminId]
    })
    console.log(`  ✅ Admin user state reset (offline, cleared status)`)
  } catch (e: any) {
    console.log(`  ⚠️  Admin reset: ${e.message}`)
  }

  // Step 9: Verify
  console.log('\n📋 Verification:')
  const tables = ['User', 'Chat', 'Message', 'CommunityPost', 'Confession', 'GroupRoom', 'Feedback', 'Report', 'Notification', 'RateLimit', 'IPRegistration']
  for (const table of tables) {
    try {
      const result = await client.execute(`SELECT COUNT(*) as count FROM ${table}`)
      const count = Number(result.rows[0].count)
      console.log(`  ${table}: ${count} rows`)
    } catch (e: any) {
      console.log(`  ${table}: error - ${e.message}`)
    }
  }

  const remainingUsers = await client.execute("SELECT nickname, is_admin FROM User")
  console.log(`\n👤 Remaining users:`)
  for (const row of remainingUsers.rows) {
    console.log(`  - ${row.nickname} (admin: ${row.is_admin})`)
  }

  console.log('\n✨ Database cleanup complete!')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
