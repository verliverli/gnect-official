'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// ============================================
// Modern Photo Viewer
// Normal photos: white X = close viewer
// View-once photos: SINGLE X button = DELETE from both sides (no close without deleting)
// Swipe-down-to-close works for normal photos only
// For view-once: swipe-down also triggers delete
// Modern animation: scale + fade in, shrink + fade out
// ============================================

interface PhotoViewerProps {
  imageUrl: string | null
  isViewOnce?: boolean
  onClose: () => void
  onDeleteBothSides?: () => Promise<void>  // Called when view-once delete X is clicked — MUST be awaited before closing
}

export function PhotoViewer({ imageUrl, isViewOnce = false, onClose, onDeleteBothSides }: PhotoViewerProps) {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const dragStartRef = useRef<{ y: number; time: number } | null>(null)

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleDeleteBothSides = useCallback(async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onDeleteBothSides?.()  // AWAIT the delete before closing!
    } catch {
      // Delete failed, still close but the error was already shown by the caller
    } finally {
      setDeleting(false)
      onClose()
    }
  }, [deleting, onDeleteBothSides, onClose])

  // Swipe down gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    dragStartRef.current = { y: touch.clientY, time: Date.now() }
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return
    const touch = e.touches[0]
    const dy = touch.clientY - dragStartRef.current.y
    if (dy > 0) setDragY(dy)
  }, [])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (dragY > 100) {
      if (isViewOnce) {
        // View-once: swipe down also triggers delete
        handleDeleteBothSides()
      } else {
        handleClose()
      }
    }
    setDragY(0)
    dragStartRef.current = null
  }, [dragY, handleClose, handleDeleteBothSides, isViewOnce])

  // Mouse drag support
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragStartRef.current = { y: e.clientY, time: Date.now() }
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return
    const dy = e.clientY - dragStartRef.current.y
    if (dy > 0) setDragY(dy)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    if (dragY > 100) {
      if (isViewOnce) {
        handleDeleteBothSides()
      } else {
        handleClose()
      }
    }
    setDragY(0)
    dragStartRef.current = null
  }, [dragY, handleClose, handleDeleteBothSides, isViewOnce])

  if (!imageUrl) return null

  const opacity = Math.max(0, 1 - dragY / 400)
  const scale = Math.max(0.8, 1 - dragY / 1000)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: isViewOnce ? 0.5 : 0.9 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none"
        style={{ opacity }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setDragY(0) }}
      >
        {/* ===== VIEW-ONCE: Single X button = DELETE both sides ===== */}
        {isViewOnce && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5"
          >
            <motion.button
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleDeleteBothSides}
              disabled={deleting}
              className="w-14 h-14 rounded-full bg-red-600/90 backdrop-blur-md flex items-center justify-center active:bg-red-700 transition-colors touch-manipulation shadow-lg shadow-red-600/40 border border-red-400/30"
              aria-label="Delete photo for both sides"
            >
              {deleting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <X className="w-7 h-7 text-white" strokeWidth={3} />
              )}
            </motion.button>
          </motion.div>
        )}

        {/* Photo — modern scale-in animation */}
        <motion.img
          src={imageUrl}
          alt={isViewOnce ? 'View-once photo' : 'Photo'}
          className="max-w-full max-h-full object-contain select-none pointer-events-none"
          style={{ transform: `translateY(${dragY}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }}
          draggable={false}
          onLoad={() => setHasLoaded(true)}
          onError={() => setHasError(true)}
        />

        {/* Loading spinner while photo loads */}
        {!hasLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full"
            />
          </div>
        )}

        {/* Error state — image failed to load */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-3">
                <X className="w-6 h-6 text-white/60" />
              </div>
              <p className="text-white/50 text-sm">Failed to load photo</p>
              <p className="text-white/30 text-xs mt-1">Tap X to close</p>
            </div>
          </div>
        )}

        {/* ===== NORMAL PHOTO: White X close button on top-right ===== */}
        {!isViewOnce && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            onClick={handleClose}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center active:bg-black/60 transition-colors z-10 touch-manipulation border border-white/10"
            aria-label="Close photo viewer"
          >
            <X className="w-6 h-6 text-white" />
          </motion.button>
        )}

        {/* Swipe hint */}
        {dragY > 20 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(1, dragY / 100) }}
            className="absolute bottom-8 left-0 right-0 flex items-center justify-center z-10"
          >
            <span className="text-white/60 text-sm">
              {isViewOnce ? 'Release to delete' : 'Release to close'}
            </span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
