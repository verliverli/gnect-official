'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, Flame, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// ============================================
// Seriousness Gate — Screening step during registration
// Filters out unserious people, scammers, and time-wasters
// Appears AFTER Age Gate and BEFORE registration form
// ============================================

interface SeriousnessGateProps {
  onConfirm: () => void
}

export function SeriousnessGate({ onConfirm }: SeriousnessGateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4"
      role="main"
      aria-label="Seriousness screening"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: 0.05 }}
        className="text-center mb-6"
      >
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Flame className="w-7 h-7 text-primary" /> <span className="gnect-gradient-text">GNECT</span></h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: 0.1 }}
      >
        <Card className="w-full max-w-sm border-border/30 gnect-glass-elevated">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground">
                This app is for REAL ones only.
              </h2>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                Your privacy is non-negotiable. Everything auto-deletes. No data is shared. Ever.
              </p>
            </div>

            {/* What we expect — checkmarks */}
            <div className="w-full rounded-2xl bg-primary/5 border border-primary/20 p-3 text-left space-y-2">
              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider">You confirm that:</p>
              <p className="text-[9px] text-primary/50 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Privacy-first. No tracking. No data selling.</p>
              <ul className="space-y-1.5">
                {[
                  'You are genuinely interested',
                  'You are serious about meeting',
                  "You respect others' privacy — what happens here stays here",
                  'You are NOT a scammer',
                  "You are NOT here to waste people's time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary shrink-0 mt-0.5"><CheckCircle2 className="w-4 h-4" /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What we don't want — X marks */}
            <div className="w-full rounded-2xl bg-destructive/5 border border-destructive/20 p-3 text-left space-y-2">
              <p className="text-[10px] font-semibold text-destructive/70 uppercase tracking-wider">We don&apos;t want:</p>
              <ul className="space-y-1.5">
{[
                  'Time wasters',
                  'Fake profiles',
                  'Catfish',
                  'People pretending to be something they\'re not',
                  'Straight guys trolling or spying',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-destructive shrink-0 mt-0.5"><XCircle className="w-4 h-4" /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirm button — MUST tap to proceed */}
            <div className="flex flex-col gap-3 w-full mt-1">
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold gnect-press gnect-transition"
                onClick={onConfirm}
                aria-label="Confirm you are a real, serious user"
              >
                I&apos;m Real, Let Me In
              </Button>
            </div>

            {/* Footer warning */}
            <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed mt-1 flex items-center justify-center gap-1">
              Violating these rules = instant permanent ban. No second chances. <Lock className="w-3 h-3" /> Your data auto-deletes.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
