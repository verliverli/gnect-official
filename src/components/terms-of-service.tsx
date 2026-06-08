'use client'

import { X, FileText, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

// ============================================
// TERMS OF SERVICE — Phase 8
// Full-screen overlay with GNECT's legal terms
// ============================================

interface TermsOfServiceProps {
  onClose: () => void
}

export function TermsOfService({ onClose }: TermsOfServiceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-label="Terms of Service"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose} aria-label="Close Terms of Service">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Terms of Service
          </h2>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-6 text-sm text-foreground/90 leading-relaxed">
          <p className="text-xs text-muted-foreground">Last updated: June 2026</p>

          {/* 1. Acceptance */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">1. Acceptance of Terms</h3>
            <p>
              By accessing or using GNECT (&quot;the App&quot;), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use the App. These terms apply to all visitors, users, and others who access or use the App.
            </p>
          </section>

          {/* 2. Age Requirement */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">2. Age Requirement</h3>
            <p>
              You must be at least 18 years old to use GNECT. By using this App, you represent and warrant that you are at least 18 years of age. If we discover that a user under 18 has accessed the App, we will immediately terminate their account and delete all associated data.
            </p>
          </section>

          {/* 3. Nature of Service */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">3. Nature of Service</h3>
            <p>
              GNECT is a privacy-first connection platform designed for consensual adult interactions. It is NOT a dating app. It is NOT a social network. It is a utility for adults to meet, connect, and interact privately.
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Users are anonymous by default — no email, phone, or real name required</li>
              <li>All content is subject to auto-deletion as specified in the App</li>
              <li>The App is provided &quot;as is&quot; without warranties of any kind</li>
              <li>We do not guarantee the accuracy of any user-provided information</li>
            </ul>
          </section>

          {/* 4. User Conduct */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">4. User Conduct</h3>
            <p>You agree NOT to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Use the App if you are under 18 years of age</li>
              <li>Share content involving minors in any capacity</li>
              <li>Harass, threaten, or intimidate other users</li>
              <li>Share another user&apos;s private information without consent</li>
              <li>Impersonate another person or misrepresent your identity</li>
              <li>Use the App for illegal activities of any kind</li>
              <li>Attempt to hack, exploit, or compromise the App&apos;s security</li>
              <li>Create multiple accounts to circumvent restrictions</li>
              <li>Share content that violates applicable laws in your jurisdiction</li>
              <li>Use the App for commercial solicitation or spam</li>
            </ul>
          </section>

          {/* 5. Privacy & Data */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">5. Privacy & Data</h3>
            <p>
              Your privacy is our core principle. We collect the minimum data necessary to operate the App. Our Privacy Policy (available separately) details what data we collect, how we use it, and how you can control it.
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>No email, phone number, or real name required</li>
              <li>Messages and media are automatically deleted per the App&apos;s timers</li>
              <li>Account deletion permanently removes your data</li>
              <li>We do not sell your personal data to third parties</li>
            </ul>
          </section>

          {/* 6. Content & Media */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">6. Content & Media</h3>
            <p>
              You retain ownership of content you share. By sharing content, you grant other users the ability to view it within the App according to the sharing settings you choose. All shared media is subject to auto-deletion timers.
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>View-once content is deleted after viewing and cannot be recovered</li>
              <li>Media auto-deletes after specified periods (30 min unopened, 24h opened, 7 days text)</li>
              <li>We are not responsible for content shared between users</li>
              <li>We implement anti-screenshot measures, but cannot guarantee complete prevention</li>
            </ul>
          </section>

          {/* 7. Account Termination */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">7. Account Termination</h3>
            <p>
              You may delete your account at any time. Account deletion offers two options:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>Soft Delete:</strong> 30-day grace period during which you can recover your account</li>
              <li><strong>Nuclear Delete:</strong> Immediate and permanent deletion with no recovery possible</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these Terms, particularly in cases involving minors, harassment, or illegal activity.
            </p>
          </section>

          {/* 8. Reporting & Moderation */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">8. Reporting & Moderation</h3>
            <p>
              We rely on community reporting to maintain a safe environment. Users can report violations through the App. Accounts that receive 5 or more valid reports may be automatically suspended pending review.
            </p>
          </section>

          {/* 9. Disclaimer of Warranties */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">9. Disclaimer of Warranties</h3>
            <p>
              GNECT is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We do not warrant that:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>The App will be uninterrupted, timely, secure, or error-free</li>
              <li>The results obtained from the use of the App will be accurate or reliable</li>
              <li>The quality of any content, information, or other material obtained through the App will meet your expectations</li>
            </ul>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">10. Limitation of Liability</h3>
            <p>
              To the fullest extent permitted by applicable law, GNECT and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, goodwill, or other intangible losses resulting from your use of the App.
            </p>
          </section>

          {/* 11. Changes to Terms */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">11. Changes to Terms</h3>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the App after any changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* 12. Jurisdiction */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">12. Jurisdiction</h3>
            <p>
              These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through the support channels provided within the App.
            </p>
          </section>

          {/* 13. Contact */}
          <section>
            <h3 className="text-base font-bold text-foreground mb-2">13. Contact</h3>
            <p>
              For questions about these Terms, please contact us through the App&apos;s support channels or report a concern directly through the App.
            </p>
          </section>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              By using GNECT, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
