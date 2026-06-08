'use client'

import { useMemo } from 'react'

// ─── Gradient Palette (green/earth tones, NO blue/indigo) ───────────────────
const GRADIENT_PALETTES = [
  ['#059669', '#34d399'], // Emerald green
  ['#22c55e', '#86efac'], // Grass green
  ['#16a34a', '#86efac'], // Green
  ['#ca8a04', '#fde047'], // Gold/amber
  ['#dc2626', '#fca5a5'], // Red/coral
  ['#d97706', '#fdba74'], // Orange
  ['#065f46', '#6ee7b7'], // Dark emerald
  ['#9f1239', '#fda4af'], // Rose
  ['#854d0e', '#fde68a'], // Warm amber
  ['#166534', '#bbf7d0'], // Forest green
]

// ─── Deterministic hash function ─────────────────────────────────────────────
function hashNickname(nickname: string): number {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    const ch = nickname.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0 // multiply by 31 and add char code
    hash = (hash * 2654435761) | 0 // Knuth multiplicative hash for better distribution
  }
  return Math.abs(hash)
}

// ─── Pattern type enum ──────────────────────────────────────────────────────
type PatternType = 'overlapping-circles' | 'diamond' | 'hexagon' | 'layered-circles'

const PATTERN_TYPES: PatternType[] = [
  'overlapping-circles',
  'diamond',
  'hexagon',
  'layered-circles',
]

// ─── Sub-component: Overlapping Circles ──────────────────────────────────────
function OverlappingCircles({
  color1,
  color2,
  rotation,
}: {
  color1: string
  color2: string
  rotation: number
}) {
  return (
    <g transform={`rotate(${rotation}, 50, 50)`}>
      <circle cx="35" cy="38" r="28" fill={color1} opacity="0.7" />
      <circle cx="65" cy="38" r="28" fill={color2} opacity="0.7" />
      <circle cx="50" cy="62" r="28" fill={color1} opacity="0.5" />
      {/* Subtle highlight */}
      <circle cx="40" cy="30" r="8" fill="white" opacity="0.12" />
    </g>
  )
}

// ─── Sub-component: Diamond ──────────────────────────────────────────────────
function Diamond({
  color1,
  color2,
  rotation,
}: {
  color1: string
  color2: string
  rotation: number
}) {
  return (
    <g transform={`rotate(${rotation}, 50, 50)`}>
      {/* Outer diamond */}
      <rect
        x="22"
        y="22"
        width="56"
        height="56"
        rx="4"
        fill={color1}
        opacity="0.85"
        transform="rotate(45, 50, 50)"
      />
      {/* Inner diamond */}
      <rect
        x="32"
        y="32"
        width="36"
        height="36"
        rx="3"
        fill={color2}
        opacity="0.7"
        transform="rotate(45, 50, 50)"
      />
      {/* Center accent circle */}
      <circle cx="50" cy="50" r="10" fill={color1} opacity="0.9" />
      {/* Subtle highlight */}
      <circle cx="38" cy="34" r="6" fill="white" opacity="0.1" />
    </g>
  )
}

// ─── Sub-component: Hexagon ──────────────────────────────────────────────────
function HexagonPattern({
  color1,
  color2,
  rotation,
}: {
  color1: string
  color2: string
  rotation: number
}) {
  // Hexagon points centered at (50,50) with radius ~32
  const hexPoints = (cx: number, cy: number, r: number) => {
    const pts: string[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
    }
    return pts.join(' ')
  }

  return (
    <g transform={`rotate(${rotation}, 50, 50)`}>
      {/* Outer hexagon */}
      <polygon points={hexPoints(50, 50, 34)} fill={color1} opacity="0.85" />
      {/* Inner hexagon — offset slightly */}
      <polygon points={hexPoints(54, 46, 20)} fill={color2} opacity="0.7" />
      {/* Center dot */}
      <circle cx="50" cy="50" r="5" fill={color1} opacity="0.9" />
      {/* Subtle highlight */}
      <circle cx="42" cy="38" r="5" fill="white" opacity="0.1" />
    </g>
  )
}

// ─── Sub-component: Layered Circles ──────────────────────────────────────────
function LayeredCircles({
  color1,
  color2,
  rotation,
}: {
  color1: string
  color2: string
  rotation: number
}) {
  return (
    <g transform={`rotate(${rotation}, 50, 50)`}>
      {/* Outermost ring */}
      <circle cx="50" cy="50" r="36" fill={color1} opacity="0.6" />
      {/* Middle ring */}
      <circle cx="50" cy="50" r="26" fill={color2} opacity="0.7" />
      {/* Inner filled circle */}
      <circle cx="50" cy="50" r="16" fill={color1} opacity="0.85" />
      {/* Tiny center dot */}
      <circle cx="50" cy="50" r="5" fill={color2} opacity="0.9" />
      {/* Subtle highlight */}
      <circle cx="42" cy="38" r="6" fill="white" opacity="0.1" />
    </g>
  )
}

// ─── Pattern renderer ────────────────────────────────────────────────────────
function renderPattern(
  type: PatternType,
  color1: string,
  color2: string,
  rotation: number
) {
  switch (type) {
    case 'overlapping-circles':
      return <OverlappingCircles color1={color1} color2={color2} rotation={rotation} />
    case 'diamond':
      return <Diamond color1={color1} color2={color2} rotation={rotation} />
    case 'hexagon':
      return <HexagonPattern color1={color1} color2={color2} rotation={rotation} />
    case 'layered-circles':
      return <LayeredCircles color1={color1} color2={color2} rotation={rotation} />
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export interface GeometricAvatarProps {
  nickname: string // Used as hash seed for deterministic generation
  size?: number | string // Width/height, default 72
  className?: string // Additional CSS classes
}

export function GeometricAvatar({
  nickname,
  size = 72,
  className = '',
}: GeometricAvatarProps) {
  // Deterministically compute avatar properties from nickname
  const { gradientIndex, patternType, rotation } = useMemo(() => {
    const h = hashNickname(nickname)

    // Pick gradient pair
    const gradientIndex = h % GRADIENT_PALETTES.length

    // Pick pattern type
    const patternIndex = Math.floor(h / GRADIENT_PALETTES.length) % PATTERN_TYPES.length
    const patternType = PATTERN_TYPES[patternIndex]

    // Rotation: 0, 15, 30, or 45 degrees — subtle, not disorienting
    const rotationOptions = [0, 15, 30, 45]
    const rotationIndex = Math.floor(h / (GRADIENT_PALETTES.length * PATTERN_TYPES.length)) % rotationOptions.length
    const rotation = rotationOptions[rotationIndex]

    return { gradientIndex, patternType, rotation }
  }, [nickname])

  const [color1, color2] = GRADIENT_PALETTES[gradientIndex]

  // Resolve size to CSS value
  const dimension = typeof size === 'number' ? `${size}px` : size

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={dimension}
      height={dimension}
      className={`shrink-0 ${className}`}
      style={{ minWidth: dimension, minHeight: dimension }}
      aria-label={`Avatar for ${nickname}`}
      role="img"
    >
      {/* Background gradient */}
      <defs>
        <radialGradient id={`bg-${nickname}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={color2} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color1} stopOpacity="0.15" />
        </radialGradient>
      </defs>

      {/* Soft gradient background fill */}
      <rect width="100" height="100" fill={`url(#bg-${nickname})`} />

      {/* Base subtle tint */}
      <rect width="100" height="100" fill={color1} opacity="0.08" />

      {/* Geometric pattern */}
      {renderPattern(patternType, color1, color2, rotation)}

      {/* Soft vignette overlay for depth */}
      <defs>
        <radialGradient id={`vignette-${nickname}`} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="black" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#vignette-${nickname})`} />
    </svg>
  )
}
