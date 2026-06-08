'use client'

import { useState } from 'react'
import { X, Trash2, AlertTriangle, Clock, Zap, Shield, Loader2, Check, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

interface DeleteAccountProps {
  onClose: () => void
}

type Step = 'choose' | 'confirm' | 'deleting' | 'done'

export function DeleteAccount({ onClose }: DeleteAccountProps) {
  const { user, logout } = useAuthStore()
  const [step, setStep] = useState<Step>('choose')
  const [deletionType, setDeletionType] = useState<'soft' | 'nuclear' | null>(null)
  const [confirmNickname, setConfirmNickname] = useState('')
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (!deletionType) return
    if (confirmNickname !== user?.nickname) {
      setError('Nickname does not match')
      return
    }

    setStep('deleting')
    setError('')

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: deletionType, confirmNickname }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        setStep('done')
        toast.success(data.message)
      } else {
        setError(data.error || 'Deletion failed')
        setStep('confirm')
      }
    } catch {
      setError('Network error. Please try again.')
      setStep('confirm')
    }
  }

  const handleDone = () => {
    logout()
    onClose()
  }

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
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={step === 'deleting' ? undefined : onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Delete Account
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-6">
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {step === 'choose' && (
              <motion.div
                key="choose"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">This action is serious</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deleting your account removes your profile, photos, messages, and all data. Choose carefully.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Soft Delete Option */}
                <button
                  onClick={() => { setDeletionType('soft'); setStep('confirm') }}
                  className="w-full text-left p-5 rounded-2xl border-2 border-border hover:border-primary/30 bg-card transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold">Soft Delete</p>
                      <p className="text-xs text-muted-foreground mt-1">30-day grace period</p>
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3.5 h-3.5 inline text-green-500" /> Your profile is hidden immediately</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3.5 h-3.5 inline text-green-500" /> You can recover by logging in within 30 days</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3.5 h-3.5 inline text-green-500" /> After 30 days, everything is permanently deleted</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3.5 h-3.5 inline text-green-500" /> Chats with others are preserved for them</p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Nuclear Self-Destruct Option */}
                <button
                  onClick={() => { setDeletionType('nuclear'); setStep('confirm') }}
                  className="w-full text-left p-5 rounded-2xl border-2 border-border hover:border-destructive/30 bg-card transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-destructive">Nuclear Self-Destruct</p>
                      <p className="text-xs text-muted-foreground mt-1">Instant permanent deletion</p>
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs text-muted-foreground">Everything deleted immediately</p>
                        <p className="text-xs text-muted-foreground">No recovery possible — ever</p>
                        <p className="text-xs text-muted-foreground">All messages, photos, posts — gone</p>
                        <p className="text-xs text-muted-foreground">Like you never existed on GNECT</p>
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            )}

            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <button
                  onClick={() => { setStep('choose'); setDeletionType(null); setConfirmNickname(''); setError('') }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 inline" /> Back to options
                </button>

                {deletionType === 'soft' ? (
                  <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/10">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-600">Soft Delete Confirmation</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your profile will be hidden from Discover immediately. You have 30 days to change your mind — just log back in to recover. After 30 days, your account and all data will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> NUCLEAR SELF-DESTRUCT</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This is <strong>PERMANENT and IRREVERSIBLE</strong>. Your account, all messages, photos, posts, and data will be instantly deleted. You will <strong>NEVER</strong> be able to recover this account. There is no undo button.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">
                    Type your nickname <span className="text-primary font-bold">{user?.nickname}</span> to confirm
                  </p>
                  <Input
                    value={confirmNickname}
                    onChange={(e) => { setConfirmNickname(e.target.value); setError('') }}
                    className="text-sm h-12 rounded-xl"
                    placeholder={user?.nickname}
                    autoComplete="off"
                  />
                  {error && (
                    <p className="text-xs text-destructive mt-1">{error}</p>
                  )}
                </div>

                <Button
                  variant={deletionType === 'nuclear' ? 'destructive' : 'default'}
                  className="w-full rounded-xl h-12 text-base font-semibold"
                  onClick={handleDelete}
                  disabled={confirmNickname !== user?.nickname}
                >
                  {deletionType === 'nuclear' ? (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Self-Destruct My Account
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Delete My Account
                    </>
                  )}
                </Button>

                <p className="text-[10px] text-center text-muted-foreground">
                  This cannot be undone {deletionType === 'nuclear' ? '— not now, not ever' : 'after 30 days'}
                </p>
              </motion.div>
            )}

            {step === 'deleting' && (
              <motion.div
                key="deleting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-20 space-y-4"
              >
                <Loader2 className="w-12 h-12 text-destructive animate-spin" />
                <p className="text-sm font-semibold">
                  {deletionType === 'nuclear' ? 'Self-destructing...' : 'Deleting your account...'}
                </p>
                <p className="text-xs text-muted-foreground">Please wait, this may take a moment</p>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-16 space-y-4"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-bold">
                  {deletionType === 'nuclear' ? 'Account Destroyed' : 'Account Deleted'}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  {deletionType === 'nuclear'
                    ? 'Your account and all data have been permanently removed. Like you were never here.'
                    : 'Your account is hidden. You have 30 days to log back in and recover it.'}
                </p>
                <Button className="w-full max-w-xs rounded-xl h-12 mt-4" onClick={handleDone}>
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
