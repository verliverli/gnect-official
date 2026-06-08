'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// ============================================
// AGE GATE — Phase 1 + Phase 8 Enhancement
// Legal disclaimer + age verification
// ============================================

interface AgeGateProps {
  onConfirm: () => void
}

export function AgeGate({ onConfirm }: AgeGateProps) {
  const [underage, setUnderage] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4"
      role="main"
      aria-label="Age verification"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: 0.05 }}
        className="text-center mb-8"
      >
        <h1 className="text-5xl font-bold gnect-gradient-text tracking-tight">GNECT</h1>
        <p className="text-muted-foreground mt-3 text-sm font-medium tracking-widest uppercase">Connect. Meet. Explore.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: 0.1 }}
      >
        <Card className="w-full max-w-sm border-border/30 gnect-glass-elevated">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 gnect-glow">
              <Shield className="h-7 w-7 text-primary" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Are you 18 or older?
              </h2>
              <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
                This app contains adult content and is intended for consenting adults only. You must be 18 or older to use GNECT.
              </p>
            </div>

            {/* Phase 8: Enhanced legal disclaimer */}
            <div className="w-full rounded-2xl bg-secondary/30 border border-border/30 p-3 text-left space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Legal Disclaimer</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>You confirm that you are at least 18 years of age (or the legal age of majority in your jurisdiction).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>This platform contains adult-oriented content and is not suitable for minors.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>By proceeding, you agree to our Terms of Service and Privacy Policy.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>You are solely responsible for ensuring your use of this app complies with local laws.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>GNECT is designed for privacy. No email, phone, or real name is required to create an account.</span>
                </li>
              </ul>
            </div>

            {underage ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 w-full">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-destructive text-sm font-medium">
                  Sorry, you cannot use GNECT.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full mt-1">
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold gnect-press gnect-transition"
                  onClick={onConfirm}
                  aria-label="Confirm you are 18 or older"
                >
                  I am 18+ — Enter GNECT
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-sm gnect-transition"
                  onClick={() => setUnderage(true)}
                  aria-label="Indicate you are under 18"
                >
                  I am under 18
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <p className="text-muted-foreground/40 text-xs mt-8 text-center max-w-sm">
        By continuing, you confirm you are of legal age, agree to the Terms of Service, and acknowledge the Privacy Policy.
      </p>
    </motion.div>
  )
}
