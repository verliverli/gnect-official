'use client'

import { X, Smartphone, Download, Apple, Monitor, Bell, Wifi, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface InstallGuideProps {
  onClose: () => void
}

export function InstallGuide({ onClose }: InstallGuideProps) {
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

          {/* Android Instructions */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-green-500" />
              Android
            </h3>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="text-sm font-medium">Open GNECT in Chrome</p>
                    <p className="text-xs text-muted-foreground">Visit gnect.vercel.app in Chrome browser</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="text-sm font-medium">Tap the menu ⋮</p>
                    <p className="text-xs text-muted-foreground">Three dots in the top-right corner</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
                  <div>
                    <p className="text-sm font-medium">Tap &quot;Add to Home Screen&quot;</p>
                    <p className="text-xs text-muted-foreground">Or &quot;Install app&quot; if Chrome shows the install banner</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">✓</span>
                  <div>
                    <p className="text-sm font-medium">GNECT is now on your home screen!</p>
                    <p className="text-xs text-muted-foreground">Opens like a native app, no browser bars</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* iOS Instructions */}
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
                    <p className="text-xs text-muted-foreground">Square icon with arrow pointing up at the bottom</p>
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

          {/* Desktop Instructions */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Monitor className="w-5 h-5 text-muted-foreground" />
              Desktop (Chrome/Edge)
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
        </div>
      </div>
    </motion.div>
  )
}
