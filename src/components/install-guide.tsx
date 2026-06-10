'use client'

import { X, Smartphone, Download, Apple, Monitor, Bell, Wifi, Shield, Check, Loader2, Package, MessageCircle, Heart, Users, Sparkles } from 'lucide-react'
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

  // Detect platform
  const [platform] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (typeof navigator === 'undefined') return 'desktop'
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    return 'desktop'
  })

  // Check if APK download is available
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
      try {
        fetch('/api/download', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
      } catch {}
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
            Get GNECT App
          </h2>
          <p className="text-xs text-muted-foreground">Install on your phone for the best experience</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll">
        <div className="px-4 py-4 space-y-5">

          {/* APK DOWNLOAD — for Android users */}
          {platform === 'android' && apkInfo?.available && !isInstalled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 via-green-500/5 to-transparent border border-green-500/30"
            >
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/20 mb-3">
                  <Package className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold">Download Android App</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Install directly — no Play Store needed
                  {apkInfo.version && <span className="ml-1">· v{apkInfo.version}</span>}
                  {apkInfo.size && <span className="ml-1">· {formatSize(apkInfo.size)}</span>}
                </p>
              </div>
              <Button
                onClick={handleDownloadApk}
                className="w-full h-12 text-base font-bold rounded-xl gnect-press bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Package className="w-5 h-5 mr-2" />
                Download APK
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                After download, open the APK file and tap &quot;Install&quot;
              </p>
            </motion.div>
          )}

          {/* ONE-CLICK INSTALL — shown when browser supports it */}
          {canInstall && !isInstalled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30"
            >
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-3">
                  <Download className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold">Install in One Tap</h3>
                <p className="text-xs text-muted-foreground mt-1">Your browser supports instant install</p>
              </div>
              <Button
                onClick={handleInstall}
                disabled={isLoading}
                className="w-full h-12 text-base font-bold rounded-xl gnect-press"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Install GNECT Now
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* Already installed banner */}
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

          {/* App Features — what you get */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              What You Get in the App
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Private Chat</p>
                  <p className="text-xs text-muted-foreground">1-on-1 encrypted conversations with auto-delete</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Heart className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Confessions</p>
                  <p className="text-xs text-muted-foreground">Post and read anonymous confessions from your area</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Mixer Groups</p>
                  <p className="text-xs text-muted-foreground">Group chats by interest — join or create your own</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits banner */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
            <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Why Install?
            </h3>
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

          {/* ========== ANDROID INSTRUCTIONS — ALWAYS SHOW ========== */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-green-500" />
              Android
            </h3>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              {platform === 'android' && canInstall && !isInstalled ? (
                <p className="text-xs text-emerald-400 font-medium mb-2">Tap the &quot;Install GNECT Now&quot; button above for one-tap install, or follow these steps:</p>
              ) : null}
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-400 text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="text-sm font-medium">Open GNECT in Chrome</p>
                    <p className="text-xs text-muted-foreground">Visit gnect.vercel.app in Chrome browser</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-400 text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="text-sm font-medium">Tap the menu ⋮</p>
                    <p className="text-xs text-muted-foreground">Three dots in the top-right corner</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-400 text-xs font-bold flex items-center justify-center">3</span>
                  <div>
                    <p className="text-sm font-medium">Tap &quot;Add to Home Screen&quot;</p>
                    <p className="text-xs text-muted-foreground">Or &quot;Install app&quot; if Chrome shows the install banner</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">✓</span>
                  <div>
                    <p className="text-sm font-medium">GNECT is now on your home screen!</p>
                    <p className="text-xs text-muted-foreground">Opens like a native app, no browser bars</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* ========== iOS INSTRUCTIONS — ALWAYS SHOW ========== */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Apple className="w-5 h-5 text-foreground" />
              iPhone / iPad
            </h3>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="text-sm font-medium">Open GNECT in Safari</p>
                    <p className="text-xs text-muted-foreground">Must use Safari — Chrome on iOS doesn&apos;t support this</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="text-sm font-medium">Tap the Share button</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium">⬆️</span>
                      {' '}Square icon with arrow pointing up at the bottom
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
                  <div>
                    <p className="text-sm font-medium">Scroll down, tap &quot;Add to Home Screen&quot;</p>
                    <p className="text-xs text-muted-foreground">You can rename it to something discreet</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">✓</span>
                  <div>
                    <p className="text-sm font-medium">GNECT is on your home screen!</p>
                    <p className="text-xs text-muted-foreground">Works like a native app with no Safari bars</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* ========== DESKTOP INSTRUCTIONS — ALWAYS SHOW ========== */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Monitor className="w-5 h-5 text-muted-foreground" />
              Desktop (Chrome / Edge)
            </h3>
            <div className="bg-card border border-border rounded-2xl p-4">
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="text-sm font-medium">Look for the install icon in the address bar</p>
                    <p className="text-xs text-muted-foreground">Or click Menu → &quot;Install GNECT&quot;</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">✓</span>
                  <div>
                    <p className="text-sm font-medium">GNECT opens in its own window</p>
                    <p className="text-xs text-muted-foreground">Like a desktop app, no browser UI</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* Privacy tip */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Privacy Tip:</strong> Rename the bookmark to something neutral like &quot;News&quot; or &quot;Weather&quot; for extra discretion. The app icon will still work the same.
            </p>
          </div>

          {/* No app store needed banner */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground text-center">
              <Shield className="w-3 h-3 inline mr-1 text-primary" />
              No App Store needed — GNECT installs directly from your browser. Updates are automatic.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
