'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

// ============================================
// ERROR BOUNDARY — Phase 8
// Catches render crashes and shows fallback UI
// instead of a blank white screen
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  level?: 'app' | 'screen' | 'component'
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    // Log error for debugging (no external service)
    console.error('[GNECT ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const level = this.props.level || 'component'

      // App-level error — full screen
      if (level === 'app') {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6" role="alert" aria-live="assertive">
            <div className="text-center max-w-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                GNECT hit an unexpected error. Don&apos;t worry — your data is safe. Try refreshing or go back to the home screen.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-4 p-3 rounded-xl bg-secondary/50 border border-border text-xs font-mono text-muted-foreground overflow-auto max-h-40">
                  <summary className="cursor-pointer font-semibold text-foreground mb-2">Error Details</summary>
                  <pre className="whitespace-pre-wrap break-words">{this.state.error.message}</pre>
                  {this.state.errorInfo && (
                    <pre className="whitespace-pre-wrap break-words mt-2 text-muted-foreground/60">{this.state.errorInfo.componentStack}</pre>
                  )}
                </details>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} className="w-full h-11 rounded-xl" size="lg">
                  <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="w-full h-11 rounded-xl" size="lg">
                  <Home className="w-4 h-4 mr-2" /> Go Home
                </Button>
              </div>
            </div>
          </div>
        )
      }

      // Screen-level error — takes up the content area
      if (level === 'screen') {
        return (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12" role="alert" aria-live="polite">
            <div className="text-center max-w-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">This section crashed</h2>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Something broke here. Try again or switch tabs.
              </p>
              <Button onClick={this.handleRetry} variant="outline" className="rounded-xl" size="sm">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          </div>
        )
      }

      // Component-level error — minimal inline fallback
      return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/10" role="alert" aria-live="polite">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm text-muted-foreground">Something went wrong here.</span>
          <button
            onClick={this.handleRetry}
            className="text-xs text-primary font-medium ml-auto hover:underline"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
