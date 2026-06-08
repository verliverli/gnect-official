'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LayoutDashboard, Users, AlertTriangle, MessageSquare, Lightbulb, Megaphone, Bug, ArrowLeft, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { AdminUsers } from '@/components/admin/admin-users'
import { AdminReports } from '@/components/admin/admin-reports'
import { AdminCommunity } from '@/components/admin/admin-community'
import { AdminFeedback } from '@/components/admin/admin-feedback'
import { AdminBroadcasts } from '@/components/admin/admin-broadcasts'
import { AdminErrors } from '@/components/admin/admin-errors'
import { AdminSupport } from '@/components/admin/admin-support'

type AdminTab = 'dashboard' | 'users' | 'reports' | 'community' | 'feedback' | 'support' | 'broadcasts' | 'errors'

interface AdminPanelProps {
  onClose: () => void
}

const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'users', label: 'Users', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'reports', label: 'Reports', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: 'community', label: 'Community', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: 'feedback', label: 'Feedback', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { key: 'support', label: 'Support', icon: <Headphones className="w-3.5 h-3.5" /> },
  { key: 'broadcasts', label: 'Broadcasts', icon: <Megaphone className="w-3.5 h-3.5" /> },
  { key: 'errors', label: 'Errors', icon: <Bug className="w-3.5 h-3.5" /> },
]

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [errorCount, setErrorCount] = useState<number>(0)

  const handleUnresolvedCount = (count: number) => {
    setErrorCount(count)
  }

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />
      case 'users':
        return <AdminUsers />
      case 'reports':
        return <AdminReports />
      case 'community':
        return <AdminCommunity />
      case 'feedback':
        return <AdminFeedback />
      case 'support':
        return <AdminSupport />
      case 'broadcasts':
        return <AdminBroadcasts />
      case 'errors':
        return <AdminErrors onUnresolvedCount={handleUnresolvedCount} />
      default:
        return <AdminDashboard />
    }
  }, [activeTab])

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            GNECT Admin
          </h2>
          <p className="text-[10px] text-muted-foreground">Boss Mode Control Center</p>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Tab Bar — scrollable, pill-style */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex gap-1 px-3 py-2 overflow-x-auto gnect-scroll">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 relative ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'errors' && errorCount > 0 && activeTab !== 'errors' && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                  {errorCount > 99 ? '99+' : errorCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
