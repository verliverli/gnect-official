'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, Siren, PenLine, Smartphone, Brain } from 'lucide-react'

interface PasswordWarningGateProps {
  onContinue: () => void
}

export function PasswordWarningGate({ onContinue }: PasswordWarningGateProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
    >
      <div className="max-w-sm w-full space-y-8">
        {/* Warning Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="text-center"
        >
          <AlertTriangle className="w-16 h-16 text-destructive" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-black text-center tracking-tight"
        >
          BEFORE YOU CONTINUE
        </motion.h1>

        {/* Body */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4 text-center"
        >
          <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10 space-y-3">
            <p className="text-sm font-bold text-destructive leading-relaxed">
              There is NO password recovery.
            </p>
            <p className="text-sm text-destructive/80 leading-relaxed">
              No email reset. No phone reset.
              No admin reset. NOTHING.
            </p>
            <div className="h-px bg-destructive/10" />
            <p className="text-sm font-semibold text-foreground leading-relaxed">
              If you forget your password,<br />
              your account is GONE FOREVER.
            </p>
            <p className="text-sm font-bold text-foreground leading-relaxed">
              Bye bye. No second chances.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
            <p className="text-lg font-bold text-primary flex items-center gap-2"><PenLine className="w-5 h-5" /> WRITE YOUR PASSWORD DOWN</p>
            <p className="text-lg font-bold text-primary flex items-center gap-2"><Smartphone className="w-5 h-5" /> Save it in your password manager</p>
            <p className="text-lg font-bold text-primary flex items-center gap-2"><Brain className="w-4 h-4" /> MEMORIZE IT</p>
          </div>
        </motion.div>

        {/* Checkbox */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="password-warning-ack"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="password-warning-ack"
              className="text-xs font-medium leading-snug cursor-pointer select-none"
            >
              I understand — if I forget my password, my account is gone forever and cannot be recovered
            </Label>
          </div>

          <Button
            onClick={onContinue}
            disabled={!acknowledged}
            size="lg"
            className="w-full h-12 text-base font-semibold gnect-transition"
          >
            Continue to Register
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}

interface PasswordSuccessWarningProps {
  onEnter: () => void
}

export function PasswordSuccessWarning({ onEnter }: PasswordSuccessWarningProps) {
  const [saved, setSaved] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
    >
      <div className="max-w-sm w-full space-y-8">
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="text-center"
        >
          <CheckCircle2 className="w-16 h-16 text-primary" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-2"
        >
          <h1 className="text-2xl font-black tracking-tight">Account Created!</h1>
          <p className="text-lg font-bold text-destructive flex items-center gap-2"><Siren className="w-5 h-5" /> ONE MORE THING <Siren className="w-5 h-5" /></p>
        </motion.div>

        {/* Body */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10 space-y-3">
            <p className="text-sm font-bold text-foreground leading-relaxed">
              Did you save your password?
            </p>
            <p className="text-sm font-semibold text-destructive leading-relaxed">
              There is NO recovery. None. Zero.
            </p>
            <p className="text-sm font-bold text-foreground leading-relaxed">
              Forgot = gone forever.
            </p>
          </div>
        </motion.div>

        {/* Checkbox */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="password-saved-ack"
              checked={saved}
              onCheckedChange={(checked) => setSaved(checked === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="password-saved-ack"
              className="text-xs font-medium leading-snug cursor-pointer select-none"
            >
              Yes, I saved my password
            </Label>
          </div>

          <Button
            onClick={onEnter}
            disabled={!saved}
            size="lg"
            className="w-full h-12 text-base font-semibold gnect-transition"
          >
            Enter GNECT
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
