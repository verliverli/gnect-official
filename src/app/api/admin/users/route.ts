// ============================================
// GET /api/admin/users — User management list (admin only)
// Phase 9: Paginated, filterable user list for admin panel
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const role = searchParams.get('role') || undefined
    const country = searchParams.get('country') || undefined
    const region = searchParams.get('region') || undefined
    const availability = searchParams.get('availability') || undefined
    const isBanned = searchParams.get('is_banned')
    const isPremium = searchParams.get('is_premium')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {
      is_admin: false, // Exclude admin users
    }

    if (search) {
      where.nickname = { contains: search }
    }
    if (role) {
      where.role = role
    }
    if (country) {
      where.country = country
    }
    if (region) {
      where.region = region
    }
    if (availability) {
      where.availability = availability
    }
    if (isBanned === 'true') {
      where.is_banned = true
    } else if (isBanned === 'false') {
      where.is_banned = false
    }
    if (isPremium === 'true') {
      where.is_premium = true
    } else if (isPremium === 'false') {
      where.is_premium = false
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          nickname: true,
          age: true,
          country: true,
          region: true,
          role: true,
          availability: true,
          is_banned: true,
          is_banned_posting: true,
          is_premium: true,
          is_early_adopter: true,
          is_online: true,
          last_seen: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (err) {
    console.error('Admin users list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
