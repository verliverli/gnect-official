'use client'

import { X, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

interface PrivacyPolicyProps {
  onClose: () => void
}

export function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground">Last updated: June 2026</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed text-foreground/90">

          {/* Intro */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <p className="text-sm text-primary font-medium">
              GNECT is built on privacy. We collect the absolute minimum data needed to operate. This policy explains what we collect, how we use it, and how long we keep it.
            </p>
          </div>

          {/* 1. Data We Collect */}
          <section>
            <h2 className="text-base font-bold mb-2">1. Data We Collect</h2>
            <p className="mb-2"><strong>Account Data:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Nickname (your chosen username, not your real name)</li>
              <li>Password (hashed and salted — we never see your actual password)</li>
              <li>Age (to verify you are 18+)</li>
              <li>Region (one of your country's administrative regions, for nearby matching)</li>
            </ul>
            <p className="mt-3 mb-2"><strong>Profile Data (all optional):</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Bio (up to 300 characters)</li>
              <li>Role, body type, height, weight</li>
              <li>Into tags (up to 5)</li>
              <li>Availability status</li>
              <li>Street name (for proximity matching)</li>
              <li>Photos (stored securely, auto-deleted)</li>
              <li>Quick Status (auto-deleted per your chosen duration)</li>
            </ul>
            <p className="mt-3 mb-2"><strong>What We Do NOT Collect:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Email addresses</li>
              <li>Phone numbers</li>
              <li>Real names</li>
              <li>GPS coordinates (only region-level location)</li>
              <li>Payment information</li>
              <li>Device identifiers beyond User-Agent string</li>
            </ul>
          </section>

          {/* 2. How Data is Used */}
          <section>
            <h2 className="text-base font-bold mb-2">2. How Your Data is Used</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Profile matching</strong> — Your region and profile details help others discover you and vice versa.</li>
              <li><strong>Chat delivery</strong> — Messages are relayed in real-time via Socket.io for instant delivery.</li>
              <li><strong>Community features</strong> — Anonymous posts are linked to your account for rate limiting only. Your nickname is never shown.</li>
              <li><strong>Push notifications</strong> — If you opt in, we send discreet push notifications. These contain no app name or message content.</li>
              <li><strong>Safety & moderation</strong> — Reports and blocks are used to protect the community. Auto-ban triggers after 5 unique reports.</li>
            </ul>
          </section>

          {/* 3. Data Storage */}
          <section>
            <h2 className="text-base font-bold mb-2">3. Data Storage & Retention</h2>

            <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border/50 space-y-1.5">
              <p className="text-xs font-semibold text-primary mb-2">Auto-Deletion Schedule</p>
              <div className="flex justify-between text-xs">
                <span>View-once photos</span>
                <span className="text-muted-foreground">5–10 seconds after viewing</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Unopened chat media</span>
                <span className="text-muted-foreground">30 minutes</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Opened chat media</span>
                <span className="text-muted-foreground">24 hours</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Chat text messages</span>
                <span className="text-muted-foreground">7 days</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Community posts & comments</span>
                <span className="text-muted-foreground">7 days</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Quick Status</span>
                <span className="text-muted-foreground">1–24 hours (your choice)</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span>Hard limit (everything)</span>
                <span className="text-primary">7 days maximum</span>
              </div>
            </div>

            <p className="mt-3">
              <strong>Database:</strong> User data is stored in a secure database. Messages and media auto-delete according to the schedule above. User accounts persist until you delete them or they are banned.
            </p>
            <p className="mt-2">
              <strong>Photos:</strong> Profile and chat photos are stored securely with auto-deletion. Photos are automatically deleted according to the schedule above.
            </p>
            <p className="mt-2">
              <strong>Infrastructure:</strong> GNECT uses secure hosting and infrastructure partners. We do not share your personal data with any third-party advertising or analytics services.
            </p>
          </section>

          {/* 4. Real-Time Communication */}
          <section>
            <h2 className="text-base font-bold mb-2">4. Real-Time Communication</h2>
            <p>
              Chat messages are delivered in real-time via a secure relay server. Messages pass through RAM only and are never persisted on the relay server. The database is the source of truth for message history.
            </p>
          </section>

          {/* 5. Anonymity */}
          <section>
            <h2 className="text-base font-bold mb-2">5. Anonymity</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Community posts are <strong>completely anonymous</strong>. Your nickname is never displayed. Only you can see a &quot;You&quot; badge on your own posts.</li>
              <li>Discreet push notifications show only &quot;New activity&quot; — no app name, no message content.</li>
              <li>Profile view and save notifications do not reveal who viewed or saved your profile.</li>
              <li>The Stealth App Icon feature disguises GNECT as a calculator on your home screen.</li>
            </ul>
          </section>

          {/* 6. Anti-Screenshot */}
          <section>
            <h2 className="text-base font-bold mb-2">6. Anti-Screenshot Measures</h2>
            <p>
              GNECT implements multiple anti-screenshot deterrents including blur on app switch, PrintScreen detection, view-once watermarks, and right-click blocking. However, <strong>these are deterrents, not guarantees</strong>. Web applications cannot fully prevent screenshots on mobile devices. Always use view-once for sensitive content.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-base font-bold mb-2">7. Your Rights</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Delete your account</strong> — Choose soft delete (30-day recovery) or instant self-destruct (immediate permanent deletion).</li>
              <li><strong>Hide your profile</strong> — Use &quot;Not Today&quot; to hide from Discover for 24 hours.</li>
              <li><strong>Block users</strong> — Block anyone to become mutually invisible.</li>
              <li><strong>Control notifications</strong> — Toggle each notification category independently.</li>
              <li><strong>Disable push notifications</strong> — Opt out entirely at any time.</li>
              <li><strong>Delete messages</strong> — Use ghost delete, unsend, or self-destruct timers.</li>
            </ul>
          </section>

          {/* 8. Data Security */}
          <section>
            <h2 className="text-base font-bold mb-2">8. Data Security</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Authentication uses JWT tokens stored in httpOnly cookies (not accessible via JavaScript).</li>
              <li>Passwords are hashed with bcrypt (10 salt rounds) — never stored in plain text.</li>
              <li>Push notification subscriptions are encrypted with VAPID keys.</li>
              <li>All auto-deletion is enforced server-side, not just client-side.</li>
              <li>Links are blocked in chat and community to prevent phishing and doxxing.</li>
            </ul>
          </section>

          {/* 9. IP Address */}
          <section>
            <h2 className="text-base font-bold mb-2">9. IP Address</h2>
            <p>
              Your IP address is temporarily used for rate limiting (maximum 3 registrations per IP per 24 hours) and login attempt limiting. IP addresses are not stored long-term or used for tracking. We do not log or analyze your browsing behavior.
            </p>
          </section>

          {/* 10. Children */}
          <section>
            <h2 className="text-base font-bold mb-2">10. Children&apos;s Privacy</h2>
            <p>
              GNECT is strictly for adults 18+. We do not knowingly collect data from children. If we discover that a user under 18 has created an account, it will be immediately and permanently deleted. We implement age verification, bot prevention, and community reporting to enforce this.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="text-base font-bold mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated through admin broadcast notifications within the App. Continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-base font-bold mb-2">12. Contact</h2>
            <p>
              For questions about this Privacy Policy, use the in-app feedback feature or contact us through official GNECT channels.
            </p>
          </section>

          <div className="h-8" />
        </div>
      </div>
    </motion.div>
  )
}
