import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  if (!databaseUrl) {
    throw new Error(
      'FATAL: DATABASE_URL is not set. ' +
      'Set it to your Turso database URL (libsql://...) in your environment variables.'
    )
  }

  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')) {
    // Turso cloud database
    if (!authToken) {
      throw new Error(
        'FATAL: DATABASE_URL points to Turso but DATABASE_AUTH_TOKEN is not set. ' +
        'Both are required for cloud database access.'
      )
    }

    // Prisma v6 adapter API: pass config object, NOT a pre-created client
    const adapter = new PrismaLibSQL({ url: databaseUrl, authToken })

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  // Local file: URL — only allowed in development (for sandbox testing)
  if (databaseUrl.startsWith('file:') && process.env.NODE_ENV !== 'production') {
    console.warn('[DEV] Using local SQLite database:', databaseUrl)
    return new PrismaClient({
      log: ['error', 'warn'],
    })
  }

  // If someone passes a non-Turso URL in production, fail loudly
  throw new Error(
    `FATAL: DATABASE_URL must be a Turso cloud URL (starting with libsql:// or https://). ` +
    `Got: ${databaseUrl}. Local SQLite is not supported in deployment.`
  )
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
