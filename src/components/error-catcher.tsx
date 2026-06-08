'use client'

import { useEffect } from 'react'
import { initErrorCatcher } from '@/lib/error-catcher'

export function ErrorCatcher() {
  useEffect(() => {
    initErrorCatcher()
  }, [])

  return null
}
