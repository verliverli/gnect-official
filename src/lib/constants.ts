// ============================================
// GNECT CONSTANTS
// All preset lists, enums, and configuration
// ============================================

// Multi-Country Support — Gulf Region + Poland
export const COUNTRIES = {
  "Poland": {
    flag: "🇵🇱",
    regions: [
      "Warszawa",
      "Dolnośląskie",
      "Kujawsko-pomorskie",
      "Lubelskie",
      "Lubuskie",
      "Łódzkie",
      "Małopolskie",
      "Mazowieckie",
      "Opolskie",
      "Podkarpackie",
      "Podlaskie",
      "Pomorskie",
      "Śląskie",
      "Świętokrzyskie",
      "Warmińsko-mazurskie",
      "Wielkopolskie",
      "Zachodniopomorskie",
    ],
  },
  "Qatar": {
    flag: "🇶🇦",
    regions: [
      "Ad Dawhah (Doha)",
      "Al Daayen",
      "Al Khor",
      "Al Wakrah",
      "Al Rayyan",
      "Al Shamal",
      "Umm Salal",
      "Shahaniya",
    ],
  },
  "Saudi Arabia": {
    flag: "🇸🇦",
    regions: [
      "Riyadh",
      "Makkah",
      "Medina",
      "Eastern Province (Ash Sharqiyah)",
      "Al-Qassim",
      "Hail",
      "Tabuk",
      "Al-Jawf",
      "Northern Borders",
      "Jazan",
      "Asir",
      "Al-Bahah",
      "Najran",
    ],
  },
  "UAE": {
    flag: "🇦🇪",
    regions: [
      "Abu Dhabi",
      "Dubai",
      "Sharjah",
      "Ajman",
      "Umm Al-Quwain",
      "Ras Al-Khaimah",
      "Fujairah",
    ],
  },
} as const

export type CountryName = keyof typeof COUNTRIES

// Get regions for a specific country
export function getRegionsForCountry(country: string): readonly string[] {
  return COUNTRIES[country as CountryName]?.regions ?? []
}

// Get flag emoji for a country
export function getCountryFlag(country: string): string {
  return COUNTRIES[country as CountryName]?.flag ?? "🌍"
}

// Validate that a country exists
export function isValidCountry(country: string): boolean {
  return country in COUNTRIES
}

// Validate that a region belongs to a specific country
export function isValidRegionForCountry(country: string, region: string): boolean {
  const regions = getRegionsForCountry(country)
  return regions.includes(region as any)
}

// Get all country names as array
export const COUNTRY_NAMES = Object.keys(COUNTRIES) as CountryName[]

// Roles
export const ROLES = [
  "Top",
  "Bottom",
  "Versatile",
  "Vers-Top",
  "Vers-Bottom",
  "Side",
] as const

export type Role = typeof ROLES[number]

// Body Types
export const BODY_TYPES = [
  "Slim",
  "Athletic",
  "Average",
  "Stocky",
  "Chub",
  "Bear",
] as const

export type BodyType = typeof BODY_TYPES[number]

// Into/Identity Tags — 24 named tags for wider choice
// Body types are a SEPARATE field, not duplicated here
export const INTO_TAGS = [
  // Sexual interests
  "Oral",
  "Anal",
  "Kink",
  "Group Fun",
  "BDSM",
  "Roleplay",
  "Massage",
  "Foot Play",
  "Wrestling",
  "Voyeur",
  "Exhibition",
  // Identity / Vibe
  "Twink",
  "Daddy",
  "Jock",
  "Nerdy",
  "Punk",
  "Raver",
  "Crossdresser",
  "Curious",
  "Furry",
  // Location / Logistics
  "Can Host",
  "Looking for Place",
  "Car Fun",
  "Hotel Meet",
  // Discretion
  "Discreet",
  "Public Meet",
] as const

export type IntoTag = typeof INTO_TAGS[number]

// Availability Statuses
export const AVAILABILITY_STATUSES = [
  "Available Now",
  "Tonight",
  "This Week",
  "Not Now",
] as const

export type AvailabilityStatus = typeof AVAILABILITY_STATUSES[number]

// Report Reasons
export const REPORT_REASONS = [
  "Fake",
  "Spam",
  "Underage",
  "Harassment",
] as const

export type ReportReason = typeof REPORT_REASONS[number]

// Quick Reply Messages
export const QUICK_REPLIES = [
  "My place",
  "Your place?",
  "On my way",
  "Can't now",
  "Send pic",
  "Available?",
  "👋",
] as const

// Safe Pages (for Panic Button)
export const SAFE_PAGES = [
  { id: "bbc_sport", name: "BBC Sport", url: "https://www.bbc.com/sport" },
  { id: "wikipedia", name: "Wikipedia", url: "https://www.wikipedia.org" },
  { id: "calculator", name: "Calculator", url: "/safe/calculator" },
  { id: "weather", name: "Weather", url: "https://www.weather.com" },
] as const

// Media Limits
export const MEDIA_LIMITS = {
  MAX_PHOTO_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  MAX_VOICE_NOTE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB (audio can be larger)
  MAX_VOICE_NOTE_DURATION_SECONDS: 120, // 2 minutes max
  VOICE_NOTE_FORMAT: 'audio/ogg;codecs=opus', // Telegram preferred format
  MAX_FREE_PROFILE_PHOTOS: 2,
  MAX_PREMIUM_PROFILE_PHOTOS: 5,
  MAX_INTO_TAGS: 5,
  VIEW_ONCE_DURATIONS: [5, 10], // seconds
  UNOPENED_MEDIA_DELETE_MINUTES: 30,
  OPENED_MEDIA_DELETE_HOURS: 24,
  CHAT_TEXT_DELETE_DAYS: 7,
  VOICE_NOTE_DELETE_DAYS: 7, // P1.12: voice notes auto-delete after 7 days
  HARD_DELETE_DAYS: 7,
} as const

// Rate Limits
export const RATE_LIMITS = {
  MAX_IP_REGS_PER_24H: 10,
  MAX_ACTIONS_PER_HOUR: 30,
  MIN_REGISTER_TIME_MS: 2000, // 2 seconds (honeypot timing)
  MAX_REPORTS_BEFORE_BAN: 5,
  FREE_NOT_TODAY_PER_DAY: 1,
  ROLE_CHANGE_FREE_DAYS: 60,
  ROLE_CHANGE_PREMIUM_DAYS: 30,
  REGION_CHANGE_FREE_DAYS: 60,
} as const

// Nickname Rules
export const NICKNAME_RULES = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 20,
  PATTERN: /^[a-zA-Z0-9_]+$/, // alphanumeric + underscore only
} as const

// Admin credentials are stored in environment variables for security.
// ADMIN_NICKNAME and ADMIN_PASSWORD must be set in .env
// Never hardcode credentials in source code.

// Catbox API
export const CATBOX_API = {
  UPLOAD_URL: "https://catbox.moe/user/api.php",
  DELETE_URL: "https://catbox.moe/user/api.php",
} as const

// Direct Telegram Bot API — Gulf users have direct Telegram access
// No Cloudflare Worker proxy needed
export const TELEGRAM_MEDIA = {
  BOT_TOKEN: process.env.GNECT_MEDIA_BOT_TOKEN || "",
  CHANNEL_ID: process.env.GNECT_MEDIA_CHANNEL_ID || "",
  API_BASE: "https://api.telegram.org",
} as const

// Media URL helper — handles old Catbox URLs, Cloudflare Worker URLs, and Telegram file_ids
// Telegram file_ids are stored with "tg:" prefix in the database
export function getMediaUrl(storedUrl: string | null): string | null {
  if (!storedUrl) return null
  // Old Catbox URLs — return as-is (backward compatibility)
  if (storedUrl.startsWith("https://")) return storedUrl
  // Telegram file_id — use our API route that proxies through Telegram Bot API
  if (storedUrl.startsWith("tg:")) {
    const fileId = storedUrl.slice(3) // Remove "tg:" prefix
    return `/api/media/file/${encodeURIComponent(fileId)}`
  }
  // Unknown format — return as-is
  return storedUrl
}

// ============================================
// QUICK STATUS — Phase 5
// ============================================

export const STATUS_PRESETS = [
  { text: "Looking for fun tonight 🔥", duration: "tonight" },
  { text: "Hosting rn 🏠", duration: "1h" },
  { text: "Need a place 📍", duration: "3h" },
  { text: "Chill vibes only 😎", duration: "24h" },
  { text: "Not looking, just browsing 👀", duration: "24h" },
  { text: "Available now 💚", duration: "1h" },
  { text: "Car fun 🚗", duration: "3h" },
  { text: "Hotel meet 🏨", duration: "tonight" },
  { text: "New here, say hi 👋", duration: "24h" },
  { text: "Discreet only 🤫", duration: "24h" },
] as const

export const STATUS_DURATIONS = [
  { label: "1 hour", value: "1h", ms: 60 * 60 * 1000 },
  { label: "3 hours", value: "3h", ms: 3 * 60 * 60 * 1000 },
  { label: "Tonight", value: "tonight", ms: 0 }, // special: until midnight TZ
  { label: "12 hours", value: "12h", ms: 12 * 60 * 60 * 1000 },
  { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
] as const

// ============================================
// LINK DETECTION — Security filter
// Block URLs in chat + community (phishing, spam, doxxing)
// Users are free to say anything — only links are blocked
// ============================================

export const LINK_PATTERN = /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|tz|io|co|me|info|xyz|app|dev|cc|tv|ly|gl|bit|tiny|shorty|rebrand|smarturl|click|link|url|page|site|web|online|shop|store|buzz|zone|space|live|world|life|club|fun|top|one|mobi|pro|tech|design|studio|agency)\b/i

export function containsLink(text: string | null | undefined): boolean {
  if (!text) return false
  return LINK_PATTERN.test(text)
}

// Notification types
export const NOTIFICATION_TYPES = {
  MESSAGE: "message",
  COMMUNITY: "community",
  PROFILE_VIEW: "profile_view",
  PROFILE_SAVE: "profile_save",
  ADMIN_BROADCAST: "admin_broadcast",
  SCREENSHOT: "screenshot",
  ADMIN_EVENT: "admin_event",
} as const

// Broadcast levels
export const BROADCAST_LEVELS = {
  URGENT: "urgent",
  INFO: "info",
} as const

// Country-specific Telegram Support Channels
// Users only see the channel for their own country
export const SUPPORT_CHANNELS: Record<string, string> = {
  "Poland": "https://t.me/+sxJsVO4bbRgyMDM0",
  "Qatar": "https://t.me/+eCrN4x-SgPZjOGNk",
  "Saudi Arabia": "https://t.me/+OdXuH9HNYBM2OWZk",
  "UAE": "https://t.me/+zgNczNN3-IE2ZGQ0",
}

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
  messages: true,
  community: false,
  profileViews: false,
  profileSaves: false,
  quietHoursEnabled: false,
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  discreetNotifStyle: "default",
  admin_broadcast: true,
} as const

// Confession Categories
export const CONFESSION_CATEGORIES = [
  { id: "sex_stories", label: "🔥 Sex Stories", emoji: "🔥" },
  { id: "regrets", label: "💔 Regrets", emoji: "💔" },
  { id: "fantasies", label: "😈 Fantasies", emoji: "😈" },
  { id: "secrets", label: "🤫 Secrets", emoji: "🤫" },
  { id: "coming_out", label: "🏳️‍🌈 Coming Out", emoji: "🏳️‍🌈" },
] as const

export type ConfessionCategory = typeof CONFESSION_CATEGORIES[number]['id']

// Confession Reactions
export const CONFESSION_REACTIONS = ["🔥", "😱", "😈", "💀", "😍"] as const

// Confession auto-delete: 7 days
export const CONFESSION_AUTO_DELETE_DAYS = 7

// Anonymous alias generator
export function generateAnonymousAlias(): string {
  const prefixes = ['Shadow', 'Ghost', 'Night', 'Dark', 'Wild', 'Secret', 'Hidden', 'Mystic', 'Silent', 'Deep']
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase()
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  return `${prefix}_${suffix}`
}
