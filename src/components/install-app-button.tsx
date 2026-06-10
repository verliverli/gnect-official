'use client'

import { Download, Check, Loader2 } from 'lucide-react'
import { usePwaInstall } from '@/lib/use-pwa-install'
import { toast } from 'sonner'

interface InstallAppButtonProps {
  onOpenGuide: () => void
}

/**
 * Smart install button:
 * - If browser supports beforeinstallprompt → one-click install
 * - If already installed → shows "Installed" state
 * - Otherwise → opens the install guide with manual instructions
 */
export function InstallAppButton({ onOpenGuide }: InstallAppButtonProps) {
  const { canInstall, isInstalled, promptInstall, isLoading } = usePwaInstall()

  // Already installed — show success state
  if (isInstalled) {
    return (
      <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
        <Check className="w-5 h-5 text-green-500" />
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-green-500">App Installed</p>
          <p className="text-[10px] text-muted-foreground">GNECT is on your home screen</p>
        </div>
      </div>
    )
  }

  // Browser supports one-click install
  if (canInstall) {
    return (
      <button
        onClick={async () => {
          const accepted = await promptInstall()
          if (accepted) {
            toast.success('GNECT installed!', { description: 'Find it on your home screen' })
          }
        }}
        disabled={isLoading}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors active:scale-[0.98]"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <Download className="w-5 h-5 text-primary" />
        )}
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-primary">
            {isLoading ? 'Installing...' : 'Install GNECT Now'}
          </p>
          <p className="text-[10px] text-muted-foreground">One tap — no app store needed</p>
        </div>
      </button>
    )
  }

  // Fallback — open install guide with manual instructions
  return (
    <button
      onClick={onOpenGuide}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
    >
      <Download className="w-5 h-5 text-primary" />
      <div className="flex-1 text-left">
        <p className="text-sm font-medium">Install App</p>
        <p className="text-[10px] text-muted-foreground">Add to home screen for the best experience</p>
      </div>
    </button>
  )
}
