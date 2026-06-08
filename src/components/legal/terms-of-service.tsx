'use client'

import { X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

interface TermsOfServiceProps {
  onClose: () => void
  onAgree?: () => void
  showAgreeButton?: boolean
}

export function TermsOfService({ onClose, onAgree, showAgreeButton }: TermsOfServiceProps) {
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
            <FileText className="w-5 h-5 text-primary" />
            Terms of Service
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
              By using GNECT, you agree to these terms. Please read them carefully before continuing.
            </p>
          </div>

          {/* 1. Acceptance */}
          <section>
            <h2 className="text-base font-bold mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using GNECT (&quot;the App&quot;), you confirm that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use the App.
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-base font-bold mb-2">2. Age Requirement</h2>
            <p>
              You must be at least 18 years old to use GNECT. By using this App, you represent and warrant that you are 18 years of age or older. If we discover that a user is under 18, their account will be immediately and permanently deleted.
            </p>
            <p className="mt-2">
              GNECT contains adult-oriented content and is designed for consenting adults only. Misrepresenting your age is a violation of these terms and may result in permanent ban and legal consequences.
            </p>
          </section>

          {/* 3. Nature of Service */}
          <section>
            <h2 className="text-base font-bold mb-2">3. Nature of Service</h2>
            <p>
              GNECT is a privacy-first meetup utility for adults. It is NOT a dating app. NOT a social network. It is a tool for consenting adults to discover, chat, and meet. The App facilitates connections between users but does not guarantee the safety, behavior, or intentions of any user.
            </p>
            <p className="mt-2">
              <strong>You are solely responsible for your safety</strong> when meeting other users. GNECT is not liable for any harm, loss, or damage arising from interactions between users.
            </p>
          </section>

          {/* 4. Account & Identity */}
          <section>
            <h2 className="text-base font-bold mb-2">4. Account & Identity</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>You must provide accurate information when creating your account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>Each person may only create one account.</li>
              <li>GNECT uses nickname-based accounts with no email or phone required. You are responsible for remembering your credentials.</li>
              <li>If you lose your credentials, there is no account recovery mechanism. This is by design for your privacy.</li>
            </ul>
          </section>

          {/* 5. Content & Conduct */}
          <section>
            <h2 className="text-base font-bold mb-2">5. Content & Conduct</h2>
            <p className="mb-2">You agree NOT to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Use the App if you are under 18 years of age.</li>
              <li>Share content involving minors in any context.</li>
              <li>Harass, threaten, intimidate, or abuse other users.</li>
              <li>Share another user&apos;s personal information without consent (doxxing).</li>
              <li>Impersonate another person or create fake profiles.</li>
              <li>Use the App for any illegal purpose.</li>
              <li>Attempt to hack, exploit, or compromise the App&apos;s security.</li>
              <li>Create spam or flood the community with repetitive content.</li>
              <li>Share links to external websites (all URLs are automatically blocked for safety).</li>
            </ul>
          </section>

          {/* 6. Auto-Deletion & Data */}
          <section>
            <h2 className="text-base font-bold mb-2">6. Auto-Deletion & Data Policy</h2>
            <p>
              GNECT is designed for ephemeral communication. Content is automatically deleted according to the following schedule:
            </p>
            <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border/50 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>View-once photos</span>
                <span className="text-muted-foreground">5–10 seconds after viewing</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Unopened media</span>
                <span className="text-muted-foreground">30 minutes</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Opened media</span>
                <span className="text-muted-foreground">24 hours</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Text messages</span>
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
                <span>Hard limit (all content)</span>
                <span className="text-primary">7 days maximum</span>
              </div>
            </div>
            <p className="mt-2">
              While GNECT implements these auto-deletion mechanisms, we cannot guarantee that content has not been captured by other users through screenshots, screen recordings, or other means before deletion.
            </p>
          </section>

          {/* 7. Privacy */}
          <section>
            <h2 className="text-base font-bold mb-2">7. Privacy</h2>
            <p>
              GNECT collects minimal personal data. We do not collect email addresses, phone numbers, or real names. Your privacy is our priority. For full details, please read our{' '}
              <button
                onClick={() => {
                  if (onAgree) onAgree()
                  // If accessed from Profile, this button won't do anything special
                  // The parent component handles navigation to Privacy Policy
                }}
                className="text-primary underline hover:text-primary/80"
              >
                Privacy Policy
              </button>.
            </p>
          </section>

          {/* 8. Community */}
          <section>
            <h2 className="text-base font-bold mb-2">8. Community (Ask)</h2>
            <p>
              The Community feature allows anonymous text-only posts. All posts and comments are automatically deleted after 7 days. Users are limited to 5 posts per day. Posts must not contain illegal content, harassment, or content involving minors. Community is moderated through user reports — 5 unique reports result in automatic account ban.
            </p>
          </section>

          {/* 9. Reporting & Moderation */}
          <section>
            <h2 className="text-base font-bold mb-2">9. Reporting & Moderation</h2>
            <p>
              GNECT uses community-driven moderation. Users can report other users and community posts. Accounts that receive 5 unique reports are automatically banned. GNECT reserves the right to ban or suspend any account at our discretion for violations of these terms, without prior notice.
            </p>
          </section>

          {/* 10. Account Deletion */}
          <section>
            <h2 className="text-base font-bold mb-2">10. Account Deletion</h2>
            <p>
              You may delete your account at any time. Two options are available:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
              <li><strong>Soft Delete</strong> — Your profile is hidden for 30 days. You can recover your account by logging in during this period. After 30 days, all data is permanently deleted.</li>
              <li><strong>Instant Self-Destruct</strong> — Your account and all associated data are immediately and permanently deleted. This action cannot be undone.</li>
            </ul>
          </section>

          {/* 11. Disclaimers */}
          <section>
            <h2 className="text-base font-bold mb-2">11. Disclaimers</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>The App is provided &quot;as is&quot; without warranties of any kind.</li>
              <li>We do not guarantee continuous availability or error-free operation.</li>
              <li>We are not responsible for the conduct of other users.</li>
              <li>Anti-screenshot features are deterrents, not guarantees. Users may still capture content through other means.</li>
              <li>Auto-deletion is a best-effort feature. We cannot control what happens to content before it is deleted.</li>
            </ul>
          </section>

          {/* 12. Limitation of Liability */}
          <section>
            <h2 className="text-base font-bold mb-2">12. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, GNECT and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, including but not limited to loss of data, personal injury, or damages from interactions with other users.
            </p>
          </section>

          {/* 13. Changes */}
          <section>
            <h2 className="text-base font-bold mb-2">13. Changes to Terms</h2>
            <p>
              We may update these Terms of Service from time to time. Continued use of the App after changes constitutes acceptance of the new terms. Material changes will be communicated through admin broadcast notifications within the App.
            </p>
          </section>

          {/* 14. Governing Law */}
          <section>
            <h2 className="text-base font-bold mb-2">14. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through the support channels provided within the App.
            </p>
          </section>

          {/* 15. Contact */}
          <section>
            <h2 className="text-base font-bold mb-2">15. Contact</h2>
            <p>
              For questions about these Terms of Service, use the in-app feedback feature or contact us through official GNECT channels.
            </p>
          </section>

          <div className="h-8" />
        </div>
      </div>

      {/* Agree button (for registration flow) */}
      {showAgreeButton && (
        <div className="shrink-0 px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm safe-bottom">
          <Button
            className="w-full rounded-xl h-12 text-base font-semibold"
            onClick={onAgree || onClose}
          >
            I Agree to the Terms of Service
          </Button>
        </div>
      )}
    </motion.div>
  )
}
