'use client'

import { X, Download, Check, Loader2, Package, Smartphone, Apple, Monitor, Bell, Wifi, Shield, ChevronDown, ExternalLink } from 'lucide-react'
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

  const [apkInfo, setApkInfo] = useState<DownloadInfo | null>(null)
  const [apkChecking, setApkChecking] = useState(true)
  const [openSection, setOpenSection] = useState<string | null>(null)

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

  const toggleSection = (s: string) => setOpenSection(openSection === s ? null : s)

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
            Install Guide
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll">
        <div className="px-4 py-6 space-y-4">

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

          {/* ============================================ */}
          {/* SECTION 1: Download APK */}
          {/* ============================================ */}
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 overflow-hidden">
            <button
              onClick={() => toggleSection('apk')}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-500">1. Download APK</p>
                <p className="text-[10px] text-muted-foreground">Android only · Install without Play Store</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-green-500/50 shrink-0 transition-transform ${openSection === 'apk' ? 'rotate-180' : ''}`} />
            </button>

            {openSection === 'apk' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 space-y-3"
              >
                {/* Download button */}
                {apkInfo?.available && (
                  <Button
                    onClick={handleDownloadApk}
                    className="w-full h-11 text-base font-bold rounded-xl gnect-press bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    <Package className="w-5 h-5 mr-2" />
                    Download APK{apkInfo.size ? ` (${formatSize(apkInfo.size)})` : ''}
                  </Button>
                )}

                {apkChecking && (
                  <div className="w-full h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                  </div>
                )}

                {!apkChecking && !apkInfo?.available && (
                  <div className="p-3 rounded-xl bg-muted/50 border border-border text-center">
                    <p className="text-xs text-muted-foreground">APK not available right now</p>
                  </div>
                )}

                {/* Step by step */}
                <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Step-by-step instructions</p>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">1</span>
                    <p>Tap <strong>"Download APK"</strong> above — the file will download to your phone</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">2</span>
                    <p>Open your <strong>File Manager</strong> app (or tap the download notification)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">3</span>
                    <p>Find <strong>gnect.apk</strong> in your Downloads folder and tap it</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">4</span>
                    <p>If you see <strong>"Install blocked"</strong> — go to Settings → Allow from this source → turn <strong>ON</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">5</span>
                    <p>Go back and tap <strong>Install</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">6</span>
                    <p>Tap <strong>Open</strong> — GNECT launches as a full-screen app!</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-[10px] text-yellow-500/90">
                    <strong>Tip:</strong> If it still opens in a browser after install, uninstall it and reinstall. This ensures Android verifies the app properly.
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* ============================================ */}
          {/* SECTION 2: Android PWA (Chrome) */}
          {/* ============================================ */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
            <button
              onClick={() => toggleSection('android')}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary">2. Add to Home Screen (Android)</p>
                <p className="text-[10px] text-muted-foreground">Chrome browser · One tap install</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-primary/50 shrink-0 transition-transform ${openSection === 'android' ? 'rotate-180' : ''}`} />
            </button>

            {openSection === 'android' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 space-y-3"
              >
                {/* One-click install if supported */}
                {canInstall && !isInstalled && (
                  <Button
                    onClick={handleInstall}
                    disabled={isLoading}
                    className="w-full h-11 text-base font-bold rounded-xl gnect-press"
                    size="lg"
                  >
                    {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Installing...</> : <><Download className="w-5 h-5 mr-2" />Install Now — One Tap</>}
                  </Button>
                )}

                {/* Manual steps */}
                <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Manual steps (if button above doesn&apos;t work)</p>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                    <p>Open <strong>gnect.vercel.app</strong> in <strong>Chrome</strong> (not Samsung Internet or Firefox)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                    <p>Tap the <strong>three dots ⋮</strong> menu in the top right corner</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                    <p>Tap <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install app&quot;</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">4</span>
                    <p>Tap <strong>&quot;Add&quot;</strong> to confirm</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">5</span>
                    <p>GNECT icon appears on your home screen — tap it to open as a full app!</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-[10px] text-primary/80">
                    <strong>Important:</strong> You MUST use Chrome browser. Samsung Internet, Firefox, and Opera don&apos;t support PWA install.
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* ============================================ */}
          {/* SECTION 3: iPhone / iPad (Safari) */}
          {/* ============================================ */}
          <div className="rounded-2xl border border-foreground/15 bg-foreground/5 overflow-hidden">
            <button
              onClick={() => toggleSection('ios')}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                <Apple className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">3. Install on iPhone / iPad</p>
                <p className="text-[10px] text-muted-foreground">Safari only · Add to Home Screen</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-foreground/50 shrink-0 transition-transform ${openSection === 'ios' ? 'rotate-180' : ''}`} />
            </button>

            {openSection === 'ios' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 space-y-3"
              >
                <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Step-by-step for iPhone & iPad</p>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold">1</span>
                    <p>Open <strong>gnect.vercel.app</strong> in <strong>Safari</strong> (not Chrome — Safari only!)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold">2</span>
                    <p>Tap the <strong>Share button ⬆️</strong> at the bottom of the screen (square with arrow pointing up)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold">3</span>
                    <p>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold">4</span>
                    <p>You can rename it (optional) — then tap <strong>&quot;Add&quot;</strong> in the top right</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold">5</span>
                    <p>GNECT icon appears on your home screen — it works like a native app!</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-foreground/5 border border-foreground/15">
                  <p className="text-[10px] text-muted-foreground">
                    <strong>Note:</strong> This only works in Safari. If you&apos;re in Chrome on iPhone, copy the link and open it in Safari first.
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* ============================================ */}
          {/* SECTION 4: Desktop */}
          {/* ============================================ */}
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 overflow-hidden">
            <button
              onClick={() => toggleSection('desktop')}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Monitor className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-500">4. Install on Desktop</p>
                <p className="text-[10px] text-muted-foreground">Chrome, Edge, or Brave</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-blue-500/50 shrink-0 transition-transform ${openSection === 'desktop' ? 'rotate-180' : ''}`} />
            </button>

            {openSection === 'desktop' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 space-y-3"
              >
                {/* One-click if supported */}
                {canInstall && !isInstalled && (
                  <Button
                    onClick={handleInstall}
                    disabled={isLoading}
                    className="w-full h-11 text-base font-bold rounded-xl gnect-press bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                  >
                    {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Installing...</> : <><Download className="w-5 h-5 mr-2" />Install Now</>}
                  </Button>
                )}

                <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Chrome / Edge / Brave</p>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">1</span>
                    <p>Open <strong>gnect.vercel.app</strong> in Chrome, Edge, or Brave</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">2</span>
                    <p>Look for the <strong>install icon ⊕</strong> in the address bar (right side)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">3</span>
                    <p>Or click <strong>Menu ⋮ → &quot;Install GNECT&quot;</strong> or <strong>&quot;Install app&quot;</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">4</span>
                    <p>Click <strong>&quot;Install&quot;</strong> — GNECT opens as a desktop app!</p>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-3 space-y-2.5 text-xs">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Mac Safari</p>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">1</span>
                    <p>Open <strong>gnect.vercel.app</strong> in Safari</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">2</span>
                    <p>Click <strong>File → &quot;Add to Dock&quot;</strong> (macOS Sonoma+)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">3</span>
                    <p>Or click <strong>Share → &quot;Add to Home Screen&quot;</strong></p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Privacy tip */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">🔒 Privacy Tip:</strong> When adding to home screen, rename it to something neutral like &quot;News&quot; or &quot;Weather&quot; so no one knows what it is from your home screen.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
