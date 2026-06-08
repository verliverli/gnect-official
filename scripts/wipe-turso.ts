/**
 * GNECT — Wipe All Turso Data
 * 
 * Deletes ALL data from every table in the Turso database.
 * Keeps the schema (table structure) intact.
 * 
 * Usage:
 *   DATABASE_URL=libsql://your-db.turso.io DATABASE_AUTH_TOKEN=your-token bun run scripts/wipe-turso.ts
 */
import { createClient, type Client } from '@libsql/client'

const TURSO_URL = process.env.DATABASE_URL || ''
const TURSO_TOKEN = process.env.DATABASE_AUTH_TOKEN || ''

if (!TURSO_URL.startsWith('libsql://') && !TURSO_URL.startsWith('https://')) {
  console.error('❌ DATABASE_URL must start with libsql:// or https://')
  console.error('   Set it in .env or pass as environment variable')
  console.error('   Example: DATABASE_URL=libsql://gnect-db-xxx.turso.io DATABASE_AUTH_TOKEN=xxx bun run scripts/wipe-turso.ts')
  process.exit(1)
}

if (!TURSO_TOKEN) {
  console.error('❌ DATABASE_AUTH_TOKEN is required')
  process.exit(1)
}

const libsql: Client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
})

async function main() {
  console.log('🔄 Connecting to Turso...')

  // Get all tables
  const tables = await libsql.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'")
  const tableNames = tables.rows.map(r => r.name as string)
  
  console.log(`📋 Found ${tableNames.length} tables: ${tableNames.join(', ')}`)

  // Delete all data from each table
  for (const tableName of tableNames) {
    try {
      const countResult = await libsql.execute(`SELECT COUNT(*) as count FROM "${tableName}"`)
      const count = Number(countResult.rows[0]?.count || 0)
      
      if (count > 0) {
        await libsql.execute(`DELETE FROM "${tableName}"`)
        console.log(`  🗑️  Wiped ${count} rows from ${tableName}`)
      } else {
        console.log(`  ✅ ${tableName} was already empty`)
      }
    } catch (err: any) {
      console.error(`  ❌ Failed to wipe ${tableName}: ${err?.message}`)
    }
  }

  // Reset auto-increment counters
  try {
    await libsql.execute("DELETE FROM sqlite_sequence")
    console.log('  🗑️  Reset auto-increment counters')
  } catch {
    // sqlite_sequence may not exist
  }

  // Verify
  console.log('\n📊 Verification:')
  for (const tableName of tableNames) {
    const countResult = await libsql.execute(`SELECT COUNT(*) as count FROM "${tableName}"`)
    const count = Number(countResult.rows[0]?.count || 0)
    console.log(`  ${tableName}: ${count} rows`)
  }

  console.log('\n✅ Turso database wiped clean! Fresh start.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
