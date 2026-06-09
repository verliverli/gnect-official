// ============================================
// GNECT GROUP CHAT HELPERS
// Anonymous name generation + room utilities
// ============================================

import { db } from "./db"

/**
 * Generate a random anonymous name in the format:
 *   1 uppercase letter + 1 digit + 1-2 uppercase letters
 * Examples: A7X, K3Z, M9F, B2QK
 */
export function generateAnonymousName(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const randomLetter = () => letters[Math.floor(Math.random() * letters.length)]
  const randomDigit = () => Math.floor(Math.random() * 10).toString()
  // 50/50 chance of 1 or 2 trailing letters
  const trailingLetters = Math.random() < 0.5
    ? randomLetter()
    : randomLetter() + randomLetter()

  return randomLetter() + randomDigit() + trailingLetters
}

/**
 * Generate a unique anonymous name for a room.
 * Retries up to 10 times if there's a collision with existing names in the room.
 */
export async function generateUniqueAnonymousName(roomId: string): Promise<string> {
  const MAX_RETRIES = 10

  for (let i = 0; i < MAX_RETRIES; i++) {
    const name = generateAnonymousName()

    // Check if this name already exists in the room
    const existing = await db.groupMember.findFirst({
      where: {
        room_id: roomId,
        anonymous_name: name,
      },
      select: { id: true },
    })

    if (!existing) {
      return name
    }
  }

  // Fallback: append a random suffix to guarantee uniqueness
  const suffix = Math.floor(Math.random() * 100)
  return generateAnonymousName() + suffix
}

/**
 * Derive a room display name from a region name.
 * Examples: "Ad Dawhah (Doha)" → "Doha Room", "Riyadh" → "Riyadh Room"
 *
 * If the region has parentheses, extract the shorter name inside them.
 * Otherwise, use the region name as-is.
 */
export function roomNameFromRegion(region: string): string {
  // Handle empty/missing region gracefully
  if (!region || region.trim() === '') {
    return 'General Room'
  }
  // Extract name from parentheses if present, e.g. "Ad Dawhah (Doha)" → "Doha"
  const parenMatch = region.match(/\(([^)]+)\)/)
  const shortName = parenMatch ? parenMatch[1] : region
  return `${shortName} Room`
}
