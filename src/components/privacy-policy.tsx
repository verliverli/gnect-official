'use client'

import { X, ShieldCheck, Lock, Clock, Eye, Trash2, Bell, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

// ============================================
// PRIVACY POLICY — Phase 8
// Full-screen overlay with GNECT's privacy policy
// ============================================

interface PrivacyPolicyProps {
  onClose: () => void
}

export function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-label="Privacy Policy"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose} aria-label="Close Privacy Policy">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Privacy Policy
          </h2>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: June 2026</p>

          {/* Intro */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">Your Privacy Matters</h3>
            <p>
              GNECT is built on privacy. We believe you should be able to connect with others without exposing your identity, your data, or your safety. This policy explains what data we collect, how we use it, and how you can control it.
            </p>
          </section>

          {/* 1. Data We Collect */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              1. Data We Collect
            </h3>
            <p>We collect only the minimum data needed to operate the App:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>Nickname:</strong> Your chosen display name (not your real name)</li>
              <li><strong>Age:</strong> Self-reported age for legal compliance (18+ only)</li>
              <li><strong>Region:</strong> General area for nearby matching (not precise location)</li>
              <li><strong>Profile info:</strong> Optional details you choose to share (bio, role, tags, etc.)</li>
              <li><strong>Photos:</strong> Images you upload, stored securely with auto-deletion</li>
              <li><strong>Messages:</strong> Chat content stored temporarily for delivery, auto-deleted per timers</li>
              <li><strong>IP address:</strong> Collected at registration for rate limiting only (not stored permanently)</li>
            </ul>
            <p className="mt-2 font-medium text-foreground">
              What we DO NOT collect:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
              <li>Email address</li>
              <li>Phone number</li>
              <li>Real name or government ID</li>
              <li>Precise GPS location</li>
              <li>Payment information (at this time)</li>
              <li>Contact list or social media accounts</li>
            </ul>
          </section>

          {/* 2. How We Use Data */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">2. How We Use Your Data</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>To provide the App&apos;s core features (matching, chatting, community)</li>
              <li>To enforce safety rules (rate limiting, banning harmful users)</li>
              <li>To send discreet notifications you opt into</li>
              <li>To auto-delete content per specified timers</li>
              <li>To maintain App performance and stability</li>
            </ul>
            <p className="mt-2">
              We <strong>never</strong> sell, rent, or share your personal data with third parties for marketing purposes.
            </p>
          </section>

          {/* 3. Auto-Deletion */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              3. Auto-Deletion Policy
            </h3>
            <p>All content in GNECT has a limited lifespan:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>View-once photos:</strong> 5 or 10 seconds after viewing</li>
              <li><strong>Unopened media:</strong> 30 minutes</li>
              <li><strong>Opened media:</strong> 24 hours</li>
              <li><strong>Chat text:</strong> 7 days</li>
              <li><strong>Hard limit:</strong> All content deleted within 7 days maximum</li>
              <li><strong>Community posts:</strong> 7 days</li>
              <li><strong>Quick Status:</strong> 1h / 3h / 12h / 24h (user choice)</li>
            </ul>
            <p className="mt-2">
              Once deleted, content cannot be recovered by anyone — including us.
            </p>
          </section>

          {/* 4. Media Storage */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">4. Media Storage</h3>
            <p>
              Photos are stored securely with auto-deletion. We do not host media on our own servers. All media is subject to the auto-deletion timers listed above. We implement anti-screenshot measures but cannot guarantee complete prevention of screenshot capture.
            </p>
          </section>

          {/* 5. Real-Time Communication */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">5. Real-Time Communication</h3>
            <p>
              Chat messages pass through our secure real-time relay for instant delivery. Messages are not stored on the relay server — they exist only in RAM during transit and are persisted in the database for delivery and auto-deletion enforcement. The database is the source of truth for message history.
            </p>
          </section>

          {/* 6. Discretion Features */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              6. Discretion & Privacy Features
            </h3>
            <p>GNECT provides multiple layers of privacy protection:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>Discretion Mode:</strong> Blurs face photos by default</li>
              <li><strong>Secret Phrase:</strong> Lock photos behind a passphrase</li>
              <li><strong>Panic Button:</strong> Instant redirect to a safe page</li>
              <li><strong>Stealth App Icon:</strong> PWA shows as &quot;Calculator&quot; on home screen</li>
              <li><strong>Discreet Notifications:</strong> Disguised as weather/news/delivery alerts</li>
              <li><strong>Disappear Mode:</strong> Hides chat content in chat list</li>
              <li><strong>Not Today:</strong> Hide your profile for 24 hours</li>
              <li><strong>Anti-Screenshot:</strong> Blur on focus loss, PrintScreen detection, watermarks</li>
              <li><strong>Ghost Delete:</strong> Delete messages for you only</li>
              <li><strong>Self-Destruct Timer:</strong> Per-chat message auto-delete</li>
            </ul>
          </section>

          {/* 7. Notifications */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              7. Notifications
            </h3>
            <p>
              Push notifications (if you opt in) show only &quot;New activity&quot; — no app name, no message content. You can customize notification styles and set quiet hours. Admin broadcasts cannot be disabled.
            </p>
          </section>

          {/* 8. Account Deletion */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-primary" />
              8. Account Deletion
            </h3>
            <p>You can delete your account at any time with two options:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>Soft Delete (30-day grace):</strong> Your account is deactivated and hidden. You have 30 days to log back in and recover it. After 30 days, all data is permanently deleted.</li>
              <li><strong>Nuclear Delete (instant):</strong> All your data is immediately and permanently deleted. This cannot be undone.</li>
            </ul>
            <p className="mt-2">
              In both cases, all your messages, photos, posts, and profile data are removed from the system.
            </p>
          </section>

          {/* 9. Data Security */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              9. Data Security
            </h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Passwords are hashed using bcrypt — we never see your raw password</li>
              <li>Sessions use JWT with HTTP-only cookies (not accessible via JavaScript)</li>
              <li>Communication with our servers is encrypted (HTTPS)</li>
              <li>Real-time connections use WebSocket Secure (WSS)</li>
              <li>Push notifications use VAPID encryption</li>
              <li>Rate limiting prevents brute force attacks</li>
            </ul>
            <p className="mt-2">
              While we implement strong security measures, no system is 100% secure. We encourage you to use the App&apos;s privacy features and not share sensitive information.
            </p>
          </section>

          {/* 10. Infrastructure */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">10. Infrastructure</h3>
            <p>
              GNECT uses secure hosting and infrastructure partners. We do not share your personal data with any third-party advertising or analytics services.
            </p>
          </section>

          {/* 11. Children's Privacy */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">11. Children&apos;s Privacy</h3>
            <p>
              GNECT is strictly for adults 18 and over. We do not knowingly collect data from children. If we discover that a user under 18 has accessed the App, we will immediately delete their account and all associated data.
            </p>
          </section>

          {/* 12. Changes to This Policy */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">12. Changes to This Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. Changes will be effective immediately upon posting. We encourage you to review this policy periodically.
            </p>
          </section>

          {/* 13. Your Rights */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">13. Your Rights</h3>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Access your personal data stored in the App</li>
              <li>Delete your account and all associated data at any time</li>
              <li>Control what information you share on your profile</li>
              <li>Opt out of push notifications</li>
              <li>Report violations and harmful content</li>
              <li>Block other users from contacting you</li>
            </ul>
          </section>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Your privacy is not just a feature — it&apos;s the foundation of GNECT.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
