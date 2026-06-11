'use client'

import { Download, Check, Loader2, Package, Smartphone, Apple, Monitor } from 'lucide-react'
import { usePwaInstall } from '@/lib/use-pwa-install'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

interface DownloadInfo {
  available: boolean
  version: string
  size: number | null
  downloadUrl: string | null
  changelog: string | null
}

/**
 * Install section with ALL 4 options always visible:
 * 1. Download APK (Android)
 * 2. Install PWA via browser (Chrome add to home screen)
 * 3. Install on iOS (Safari share to home screen)
 * 4. Install on Desktop
 */
export function InstallAppButton() {
  const { canInstall, isInstalled, promptInstall, isLoading } = usePwaInstall()

  const [apkInfo, setApkInfo] = useState<DownloadInfo | null>(null)
  const [apkChecking, setApkChecking] = useState(true)

  useEffect(() => {
    fetch('/api/download')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setApkInfo({
            available: d.available,
            version: d.version,
            size: d.size,
            downloadUrl: d.downloadUrl,
            changelog: d.changelog,
          })
        }
      })
      .catch(() => {})
      .finally(() => setApkChecking(false))
  }, [])

  const handleDownloadApk = () => {
    if (apkInfo?.downloadUrl) {
      try { fetch('/api/download', { method: 'POST', credentials: 'same-origin' }).catch(() => {}) } catch {}
      window.open(apkInfo.downloadUrl, '_blank')
      toast.success('Download started!', { description: 'Open the APK file to install' })
    }
  }

  const handleBrowserInstall = async () => {
    if (canInstall) {
      const accepted = await promptInstall()
      if (accepted) {
        toast.success('GNECT installed!', { description: 'Find it on your home screen' })
      }
    } else {
      toast.info('Open Chrome menu ⋮ → "Add to Home Screen"')
    }
  }

  const handleIosInstall = () => {
    toast.info('Tap Share ⬆️ in Safari → "Add to Home Screen"')
  }

  const handleDesktopInstall = async () => {
    if (canInstall) {
      const accepted = await promptInstall()
      if (accepted) {
        toast.success('GNECT installed!', { description: 'Find it in your apps' })
      }
    } else {
      toast.info('Click the install icon in your browser address bar')
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-2">
      {/* Already installed banner */}
      {isInstalled && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 mb-1">
          <Check className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-xs font-medium text-green-500">GNECT is already installed on this device</p>
        </div>
      )}

      {/* 1. Download APK */}
      <button
        onClick={handleDownloadApk}
        disabled={!apkInfo?.available}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
      >
        <div className="h-9 w-9 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
          <Package className="w-4.5 h-4.5 text-green-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-green-500">Download APK</p>
          <p className="text-[10px] text-muted-foreground">
            {apkChecking ? 'Checking...' : apkInfo?.available ? `v${apkInfo.version || '1.0'}${apkInfo.size ? ` · ${formatSize(apkInfo.size)}` : ''} · No Play Store needed` : 'Not available'}
          </p>
        </div>
      </button>

      {/* 2. Install PWA via Browser (Chrome) */}
      <button
        onClick={handleBrowserInstall}
        disabled={isLoading}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors active:scale-[0.98]"
      >
        <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-primary">
            {isLoading ? 'Installing...' : 'Add to Home Screen'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {canInstall ? 'One tap install via Chrome' : 'Chrome ⋮ menu → Add to Home Screen'}
          </p>
        </div>
        {isLoading && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
      </button>

      {/* 3. Install on iOS (Safari) */}
      <button
        onClick={handleIosInstall}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/15 hover:bg-foreground/10 transition-colors active:scale-[0.98]"
      >
        <div className="h-9 w-9 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0">
          <Apple className="w-4.5 h-4.5 text-foreground" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold">Install on iPhone</p>
          <p className="text-[10px] text-muted-foreground">Safari → Share ⬆️ → Add to Home Screen</p>
        </div>
      </button>

      {/* 4. Desktop Install */}
      <button
        onClick={handleDesktopInstall}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors active:scale-[0.98]"
      >
        <div className="h-9 w-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <Monitor className="w-4.5 h-4.5 text-blue-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-blue-500">Install on Desktop</p>
          <p className="text-[10px] text-muted-foreground">
            {canInstall ? 'One click install' : 'Install icon in address bar or menu'}
          </p>
        </div>
      </button>
    </div>
  )
}
