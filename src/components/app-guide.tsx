'use client'

import { X, BookOpen, Compass, MessageCircle, Users, Shield, EyeOff, HelpCircle, Smartphone, Globe, ChevronRight, Search, Lightbulb, PenLine, Dumbbell, Tag, AlertTriangle, Ban, Clock, Trash2, Lock, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

// ============================================
// WHOLE APP GUIDE — Phase 8
// Accordion how-to covering ALL features
// + Access guide for Incognito & PWA setup
// ============================================

interface AppGuideProps {
  onClose: () => void
}

type GuideSection = 'discover' | 'community' | 'chats' | 'privacy' | 'profile' | 'access' | null

const SECTIONS: {
  id: GuideSection
  icon: React.ReactNode
  title: string
  subtitle: string
  color: string
}[] = [
  {
    id: 'discover',
    icon: <Compass className="w-5 h-5" />,
    title: 'Discover',
    subtitle: 'Browse nearby people, filters, spotlight',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    id: 'community',
    icon: <Users className="w-5 h-5" />,
    title: 'Community (Ask)',
    subtitle: 'Anonymous posts, upvotes, comments',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    id: 'chats',
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'Chat',
    subtitle: 'Messages, photos, view-once, self-destruct',
    color: 'text-primary bg-primary/10',
  },
  {
    id: 'privacy',
    icon: <Shield className="w-5 h-5" />,
    title: 'Privacy & Safety',
    subtitle: 'Panic button, discretion, anti-screenshot',
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    id: 'profile',
    icon: <EyeOff className="w-5 h-5" />,
    title: 'Profile & Settings',
    subtitle: 'Edit profile, status, toggles, deletion',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    id: 'access',
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Access Guide',
    subtitle: 'Incognito setup, PWA install, bookmarks',
    color: 'text-yellow-500 bg-yellow-500/10',
  },
]

export function AppGuide({ onClose }: AppGuideProps) {
  const [openSection, setOpenSection] = useState<GuideSection>(null)

  const toggleSection = (id: GuideSection) => {
    setOpenSection(openSection === id ? null : id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-label="App Guide"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose} aria-label="Close App Guide">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            How to Use GNECT
          </h2>
          <p className="text-xs text-muted-foreground">Complete guide to every feature</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll">
        <div className="px-4 py-4 space-y-2">
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className={`rounded-2xl border transition-colors ${
                openSection === section.id
                  ? 'border-primary/20 bg-card'
                  : 'border-border bg-card hover:bg-card/80'
              }`}
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 text-left min-h-[52px]"
                aria-expanded={openSection === section.id}
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${section.color}`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150 ${
                    openSection === section.id ? 'rotate-90' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {openSection === section.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0">
                      {section.id === 'discover' && <DiscoverGuide />}
                      {section.id === 'community' && <CommunityGuide />}
                      {section.id === 'chats' && <ChatsGuide />}
                      {section.id === 'privacy' && <PrivacySafetyGuide />}
                      {section.id === 'profile' && <ProfileGuide />}
                      {section.id === 'access' && <AccessGuide />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────
// GUIDE SECTIONS
// ─────────────────────────────

function DiscoverGuide() {
  return (
    <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Search className="w-4 h-4" /> Finding People</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Nearby tab:</strong> Shows people in your region only. Use filters (role, age, street, availability, body type, tags) to narrow results.</li>
        <li><strong className="text-foreground">All Users tab:</strong> Browse everyone in your country. Simple nickname search, no filters — just browsing.</li>
        <li><strong className="text-foreground">Street filter:</strong> Add your street name in profile to match with people on the same street for close meets.</li>
        <li><strong className="text-foreground">Sort options:</strong> Nearby (default), Available Now, Newest, Online Only.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Banner Cards</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Scroll vertically</strong> through banner cards showing nickname, region, role, tags, and quick status.</li>
        <li><strong className="text-foreground">Tap a card</strong> to open the full Spotlight profile view.</li>
        <li><strong className="text-foreground">Pulsing green dot</strong> means the person is Available Now.</li>
        <li><strong className="text-foreground">&quot;New Here&quot; badge</strong> means they joined in the last 7 days.</li>
        <li><strong className="text-foreground">Proximity indicator</strong> shows if they&apos;re on your street or area.</li>
        <li><strong className="text-foreground">Mutual interest</strong> highlights shared tags between you.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> Spotlight (Full Profile)</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li>Tap a banner card → full profile with all details, photos, and status.</li>
        <li><strong className="text-foreground">Message button</strong> — opens a direct chat with that person.</li>
        <li><strong className="text-foreground">Save button</strong> — bookmark their profile for later.</li>
        <li><strong className="text-foreground">Block / Report</strong> — protect yourself from unwanted users.</li>
        <li><strong className="text-foreground">Prev / Next arrows</strong> — browse profiles sequentially without going back.</li>
        <li><strong className="text-foreground">Discretion mode:</strong> Face photos are blurred. Tap &amp; hold to reveal.</li>
        <li><strong className="text-foreground">Secret phrase:</strong> Some photos require you to type a phrase to unlock.</li>
      </ul>
    </div>
  )
}

function CommunityGuide() {
  return (
    <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><PenLine className="w-4 h-4" /> Posting</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Anonymous:</strong> Your nickname is NEVER shown. All posts display &quot;Anonymous.&quot;</li>
        <li><strong className="text-foreground">Categories:</strong> Choose SFW or NSFW when creating a post.</li>
        <li><strong className="text-foreground">5 posts per day</strong> — max 2000 characters per post.</li>
        <li><strong className="text-foreground">Region tag:</strong> Optionally tag your region (e.g., Dar es Salaam).</li>
        <li><strong className="text-foreground">Auto-delete:</strong> All posts and comments are deleted after 7 days.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> Interacting</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Upvote</strong> posts you like (no downvotes — keep it positive).</li>
        <li><strong className="text-foreground">Comment</strong> on posts (also anonymous, 500 chars max).</li>
        <li><strong className="text-foreground">&quot;You&quot; badge</strong> appears on your own posts (only visible to you).</li>
        <li><strong className="text-foreground">Delete</strong> your own posts and comments anytime.</li>
        <li><strong className="text-foreground">Report</strong> posts that violate rules (Spam, Harassment, Underage, Illegal, Other).</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Feed Tabs</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">New:</strong> Latest posts first.</li>
        <li><strong className="text-foreground">Hot:</strong> Most upvoted posts.</li>
        <li><strong className="text-foreground">My Posts:</strong> Your own posts (identified by &quot;You&quot; badge).</li>
        <li><strong className="text-foreground">Filter pills:</strong> SFW / NSFW / All categories.</li>
      </ul>
    </div>
  )
}

function ChatsGuide() {
  return (
    <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Messaging</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Start a chat:</strong> From Spotlight profile → tap Message button.</li>
        <li><strong className="text-foreground">Read receipts:</strong> ✓ Sent, ✓✓ Delivered, ✓✓ (blue) Read.</li>
        <li><strong className="text-foreground">Typing indicator:</strong> See when the other person is typing.</li>
        <li><strong className="text-foreground">Quick replies:</strong> Tap preset responses for fast replies.</li>
        <li><strong className="text-foreground">Reply to message:</strong> Swipe right on a message or long-press → Reply.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Camera className="w-4 h-4" /> Photos</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Send photos:</strong> Tap the camera icon in chat. Max 2MB, JPEG/PNG/WebP.</li>
        <li><strong className="text-foreground">View-once photos:</strong> Send a photo that disappears after 5 or 10 seconds.</li>
        <li><strong className="text-foreground">Full-screen viewer:</strong> Tap any photo to view it full size.</li>
        <li><strong className="text-foreground">Discretion mode:</strong> Photos in chat are blurred by default. Tap &amp; hold to reveal.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete Options</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Ghost Delete:</strong> Long-press → &quot;Delete for me&quot; — hides from you, other person still sees it.</li>
        <li><strong className="text-foreground">Unsend:</strong> Long-press → &quot;Unsend&quot; — deletes for both sides.</li>
        <li><strong className="text-foreground">Delete chat:</strong> Removes the entire chat for both people.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-4 h-4" /> Self-Destruct</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Per-chat timer:</strong> Tap the clock icon in chat header to set (Off / 1h / 3h / 6h / 24h).</li>
        <li>Messages auto-delete after the set duration.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Shield className="w-4 h-4" /> Safety in Chat</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Block:</strong> Block from chat header — both of you become invisible to each other.</li>
        <li><strong className="text-foreground">Report:</strong> Report with a reason from chat header.</li>
        <li><strong className="text-foreground">Link blocking:</strong> URLs are automatically blocked in messages for safety.</li>
      </ul>
    </div>
  )
}


function PrivacySafetyGuide() {
  return (
    <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Emergency Exit</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Panic Button:</strong> Floating button at bottom-left → instant redirect to a safe page.</li>
        <li><strong className="text-foreground">Triple-tap header:</strong> Tap the GNECT logo 3 times fast → same panic redirect.</li>
        <li><strong className="text-foreground">Safe Page:</strong> Choose your redirect destination in Profile → Privacy (Calculator, BBC Sport, Wikipedia, Weather).</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><EyeOff className="w-4 h-4" /> Disguise & Stealth</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Stealth App Icon:</strong> PWA shows as &quot;Calculator&quot; on your home screen.</li>
        <li><strong className="text-foreground">Discreet Notifications:</strong> Choose disguised styles — Weather, News, Delivery updates.</li>
        <li><strong className="text-foreground">Disappear Mode:</strong> Hides chat content in the chat list (shows &quot;Tap to view&quot;).</li>
        <li><strong className="text-foreground">Not Today:</strong> Hide your profile from Discover for 24 hours.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Camera className="w-4 h-4" /> Anti-Screenshot</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Blur on focus loss:</strong> App blurs when you switch to another app.</li>
        <li><strong className="text-foreground">PrintScreen detection:</strong> Red flash + in-app notification if screenshot key pressed.</li>
        <li><strong className="text-foreground">View-once watermark:</strong> Your nickname overlaid on view-once photos at 7% opacity.</li>
        <li><strong className="text-foreground">Right-click block:</strong> Images can&apos;t be saved via right-click on desktop.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-4 h-4" /> Auto-Delete</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li>View-once photos: 5 or 10 seconds after viewing</li>
        <li>Unopened media: 30 minutes</li>
        <li>Opened media: 24 hours</li>
        <li>Chat text: 7 days</li>
        <li>Hard limit: Everything deleted within 7 days</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Ban className="w-4 h-4" /> Block & Report</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Block:</strong> Both of you become invisible to each other.</li>
        <li><strong className="text-foreground">Report:</strong> 4 reasons — Fake, Spam, Underage, Harassment.</li>
        <li><strong className="text-foreground">Auto-ban:</strong> 5 reports = automatic suspension.</li>
      </ul>
    </div>
  )
}

function ProfileGuide() {
  return (
    <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><PenLine className="w-4 h-4" /> Editing Your Profile</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Tap your avatar</strong> (top-left) to open Profile Panel.</li>
        <li>Sections: Bio, Status, Physical, Into Tags, Availability, Privacy, Account.</li>
        <li><strong className="text-foreground">Auto-save:</strong> Most changes save automatically (500ms debounce).</li>
        <li><strong className="text-foreground">Photos:</strong> Upload up to 2 (free) or 5 (premium). Tap to delete.</li>
        <li><strong className="text-foreground">Face/Locked badges:</strong> Mark photos as face pic or lock behind secret phrase.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Quick Status</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li>Max 100 chars, shows on your banner card + Spotlight.</li>
        <li><strong className="text-foreground">Auto-delete:</strong> Choose 1h, 3h, Tonight, 12h, or 24h.</li>
        <li><strong className="text-foreground">Quick presets:</strong> One-tap status options.</li>
        <li>1 status at a time — new one replaces old.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Dumbbell className="w-4 h-4" /> Size Field</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li>Optional — enter 1-15 inches.</li>
        <li><strong className="text-foreground">Show/Hide toggle:</strong> Choose whether others can see it.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Account Deletion</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Soft Delete:</strong> 30-day grace period. Log back in to recover. After 30 days = permanent deletion.</li>
        <li><strong className="text-foreground">Nuclear Delete:</strong> Instant, permanent, no recovery. Everything gone immediately.</li>
        <li>Both options available in Profile → Account → Delete Account.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Lock className="w-4 h-4" /> Session Manager</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li>See your current device info.</li>
        <li><strong className="text-foreground">&quot;Logout Everywhere&quot;</strong> — invalidates all other sessions.</li>
      </ul>
    </div>
  )
}

function AccessGuide() {
  return (
    <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
      <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-xs font-semibold text-yellow-500 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Why This Matters</p>
        <p className="text-xs text-muted-foreground">
          GNECT is designed for maximum privacy. Using incognito mode and the PWA ensures no browsing history is left behind and the app looks like a calculator on your home screen.
        </p>
      </div>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Globe className="w-4 h-4" /> Using Incognito Mode</h4>
      <div className="space-y-2 text-muted-foreground">
        <p><strong className="text-foreground">Android (Chrome):</strong></p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Open Chrome</li>
          <li>Tap the 3-dot menu (⋮)</li>
          <li>Select &quot;New Incognito tab&quot;</li>
          <li>Navigate to the GNECT URL</li>
          <li>Log in — your session is private</li>
        </ol>

        <p className="mt-2"><strong className="text-foreground">iPhone (Safari):</strong></p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Open Safari</li>
          <li>Tap the tabs icon (square overlapping squares)</li>
          <li>Tap the shield icon or &quot;Private&quot; at bottom</li>
          <li>Navigate to the GNECT URL</li>
          <li>Log in — your session is private</li>
        </ol>

        <p className="mt-2"><strong className="text-foreground">Desktop (Chrome/Firefox/Edge):</strong></p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Press <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Ctrl+Shift+N</kbd> (Chrome/Edge) or <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">Ctrl+Shift+P</kbd> (Firefox)</li>
          <li>Navigate to the GNECT URL</li>
          <li>Log in — no history saved</li>
        </ol>
      </div>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><Smartphone className="w-4 h-4" /> Installing as PWA</h4>
      <p className="text-muted-foreground">
        Installing GNECT as a PWA gives you a home screen icon (disguised as Calculator), full-screen experience, and push notifications.
      </p>

      <div className="space-y-2 text-muted-foreground">
        <p><strong className="text-foreground">Android (Chrome):</strong></p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Open GNECT in Chrome</li>
          <li>Tap the 3-dot menu (⋮)</li>
          <li>Tap &quot;Add to Home screen&quot; or &quot;Install app&quot;</li>
          <li>Confirm — the app icon appears on your home screen as &quot;Calculator&quot;</li>
          <li>Open it from your home screen for the full app experience</li>
        </ol>

        <p className="mt-2"><strong className="text-foreground">iPhone (Safari):</strong></p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Open GNECT in Safari</li>
          <li>Tap the Share button (square with arrow)</li>
          <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
          <li>Confirm — the app icon appears on your home screen as &quot;Calculator&quot;</li>
          <li>Open it from your home screen for the full app experience</li>
        </ol>

        <p className="mt-2"><strong className="text-foreground">Desktop (Chrome/Edge):</strong></p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Open GNECT in Chrome or Edge</li>
          <li>Click the install icon in the address bar (or menu → Install GNECT)</li>
          <li>Confirm — the app opens in its own window</li>
        </ol>
      </div>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Bookmarking Safely</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Incognito tip:</strong> Bookmarks created in incognito mode are NOT saved when you close the window. Create bookmarks in normal mode.</li>
        <li><strong className="text-foreground">Rename bookmark:</strong> Change the bookmark name to something neutral (e.g., &quot;Calculator&quot; or &quot;News&quot;).</li>
        <li><strong className="text-foreground">Bookmark folder:</strong> Save in a folder mixed with other sites for camouflage.</li>
      </ul>

      <h4 className="font-semibold text-foreground flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Safety Tips</h4>
      <ul className="space-y-2 text-muted-foreground">
        <li><strong className="text-foreground">Always use PWA or Incognito</strong> — don&apos;t leave GNECT in your normal browser tabs.</li>
        <li><strong className="text-foreground">Enable Stealth App Icon</strong> — makes the home screen icon look like a Calculator.</li>
        <li><strong className="text-foreground">Set a Safe Page</strong> — configure your panic redirect in Profile → Privacy.</li>
        <li><strong className="text-foreground">Use Discreet Notifications</strong> — so push alerts don&apos;t reveal the app.</li>
        <li><strong className="text-foreground">Enable Not Today</strong> when you can&apos;t use the app safely — hides your profile for 24h.</li>
        <li><strong className="text-foreground">Know the panic button</strong> — floating at bottom-left, or triple-tap the GNECT header.</li>
      </ul>
    </div>
  )
}
