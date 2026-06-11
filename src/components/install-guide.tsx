'use client'

import { X, Download, Check, Loader2, Package, Smartphone, Apple, Monitor, Bell, Wifi, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
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

interface InstallGuideProps {
  onClose: () => void
}

export function InstallGuide({ onClose }: InstallGuideProps) {
  const { canInstall, isInstalled, promptInstall, isLoading } = usePwaInstall()

  const [platform] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (typeof navigator === 'undefined') return 'desktop'
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    return 'desktop'
  })

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

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (accepted) {
      toast.success('GNECT installed!', { description: 'Find it on your home screen' })
    }
  }

  const handleDownloadApk = () => {
    if (apkInfo?.downloadUrl) {
      try { fetch('/api/download', { method: 'POST', credentials: 'same-origin' }).catch(() => {}) } catch {}
      window.open(apkInfo.downloadUrl, '_blank')
      toast.success('Download started!', { description: 'Open the APK file to install' })
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border gnect-glass-elevated shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10 gnect-press" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Install GNECT
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll">
        <div className="px-4 py-6 space-y-5">

          {/* Already installed */}
          {isInstalled && (
            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-500">GNECT is Installed!</p>
                <p className="text-xs text-muted-foreground">Find it on your home screen</p>
              </div>
            </div>
          )}

          {/* APK DOWNLOAD — Android */}
          {platform === 'android' && apkInfo?.available && !isInstalled && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 via-green-500/5 to-transparent border border-green-500/30">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/20 mb-2">
                  <Package className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="text-base font-bold">Download Android App</h3>
                {apkInfo.version && <p className="text-xs text-muted-foreground">v{apkInfo.version}{apkInfo.size ? ` · ${formatSize(apkInfo.size)}` : ''}</p>}
              </div>
              <Button onClick={handleDownloadApk} className="w-full h-11 text-base font-bold rounded-xl gnect-press bg-green-600 hover:bg-green-700 text-white" size="lg">
                <Package className="w-5 h-5 mr-2" />
                Download APK
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Open the APK file and tap Install</p>
            </div>
          )}

          {/* ONE-CLICK INSTALL */}
          {canInstall && !isInstalled && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 mb-2">
                  <Download className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-base font-bold">Install in One Tap</h3>
              </div>
              <Button onClick={handleInstall} disabled={isLoading} className="w-full h-11 text-base font-bold rounded-xl gnect-press" size="lg">
                {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Installing...</> : <><Download className="w-5 h-5 mr-2" />Install Now</>}
              </Button>
            </div>
          )}

          {/* Benefits */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <Bell className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-[10px] text-muted-foreground">Push Notifications</p>
              </div>
              <div className="text-center">
                <Wifi className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-[10px] text-muted-foreground">Works Offline</p>
              </div>
              <div className="text-center">
                <Shield className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-[10px] text-muted-foreground">No App Store</p>
              </div>
            </div>
          </div>

          {/* Manual instructions — always show ALL platforms */}
          <div className="space-y-4">
            {/* Android */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-green-500" />
                Android
              </h3>
              <div className="bg-card border border-border rounded-xl p-3 space-y-2 text-xs">
                <p>1. Open GNECT in <strong>Chrome</strong></p>
                <p>2. Tap menu <strong>⋮</strong> → <strong>&quot;Add to Home Screen&quot;</strong></p>
                <p>3. Done — GNECT is on your home screen!</p>
              </div>
            </div>

            {/* iOS */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Apple className="w-4 h-4 text-foreground" />
                iPhone / iPad
              </h3>
              <div className="bg-card border border-border rounded-xl p-3 space-y-2 text-xs">
                <p>1. Open GNECT in <strong>Safari</strong></p>
                <p>2. Tap <strong>Share ⬆️</strong> → <strong>&quot;Add to Home Screen&quot;</strong></p>
                <p>3. Done — works like a native app!</p>
              </div>
            </div>

            {/* Desktop */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                Desktop
              </h3>
              <div className="bg-card border border-border rounded-xl p-3 space-y-2 text-xs">
                <p>1. Click the install icon in the address bar</p>
                <p>2. Or Menu → <strong>&quot;Install GNECT&quot;</strong></p>
              </div>
            </div>
          </div>

          {/* Privacy tip */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Privacy Tip:</strong> Rename the bookmark to something neutral like &quot;News&quot; for discretion.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
