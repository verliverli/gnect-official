'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './store'

// ============================================
// GNECT Real-time Notification Socket Hook
// Connects to Socket.io server and listens for
// notification + broadcast events in real-time
// ============================================

export interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export function useNotificationSocket(onNewNotification?: (notif: NotificationData) => void) {
  const { user } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)
  const onNotifRef = useRef(onNewNotification)

  // Keep the callback ref up-to-date without triggering socket reconnection
  useEffect(() => {
    onNotifRef.current = onNewNotification
  }, [onNewNotification])

  useEffect(() => {
    if (!user) return

    // Socket.io server URL — use env var only, no hardcoded fallback
    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (!envSocketUrl) {
      console.warn('NEXT_PUBLIC_SOCKET_URL is not set — notification socket disabled')
      return
    }

    // Determine socket URL: if env points to localhost, use gateway proxy instead
    const isLocalhost = envSocketUrl.includes('localhost') || envSocketUrl.includes('127.0.0.1')
    const socketUrl = isLocalhost ? (typeof window !== 'undefined' ? window.location.origin : envSocketUrl) : envSocketUrl

    const socketOpts: Parameters<typeof io>[1] = {
      path: '/socket.io',
      query: {
        userId: user.id,
        ...(isLocalhost ? { XTransformPort: '3003' } : {}),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    }

    const socket = io(socketUrl, socketOpts)
    socketRef.current = socket

    socket.on('connect', () => {
      // Join personal room for notifications
      socket.emit('join-notifications', { userId: user.id })
    })

    // Listen for real-time notifications
    socket.on('notification', (data: NotificationData) => {
      if (onNotifRef.current) {
        onNotifRef.current(data)
      }
    })

    // Listen for admin broadcasts
    socket.on('broadcast', (data: NotificationData) => {
      if (onNotifRef.current) {
        onNotifRef.current(data)
      }
    })

    socket.on('disconnect', () => {})

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user])

  return socketRef
}
