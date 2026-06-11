/**
 * Media Utilities — Client-side image compression, validation, and upload helpers
 * 
 * Designed for slow mobile networks in Tanzania & Kenya:
 * - Compresses images BEFORE upload to save bandwidth
 * - Converts to WebP for better compression (with JPEG fallback)
 * - Strips EXIF data for privacy
 * - Provides XHR-based upload with progress tracking
 * - Includes retry logic with exponential backoff
 */

// ============================================
// Validation
// ============================================

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB pre-compression limit (we'll compress down)

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected' }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images allowed' }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'Image must be under 10MB' }
  }

  if (file.size === 0) {
    return { valid: false, error: 'Image file is empty' }
  }

  return { valid: true }
}

// ============================================
// Image Compression
// ============================================

interface CompressionOptions {
  maxSizeBytes: number
  maxWidth: number
  quality?: number // 0-1, default 0.8
  minQuality?: number // minimum quality to try, default 0.3
}

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxSizeBytes: 1024 * 1024, // 1MB target
  maxWidth: 1600,
  quality: 0.8,
  minQuality: 0.3,
}

/**
 * Compress an image file using Canvas API.
 * - Resizes images that exceed maxWidth
 * - Converts to WebP for better compression (falls back to JPEG)
 * - Strips all EXIF data for privacy
 * - Iteratively reduces quality until under maxSizeBytes
 */
export async function compressImage(
  file: File,
  maxSizeBytes: number = DEFAULT_COMPRESSION_OPTIONS.maxSizeBytes,
  maxWidth: number = DEFAULT_COMPRESSION_OPTIONS.maxWidth
): Promise<Blob> {
  const options = { ...DEFAULT_COMPRESSION_OPTIONS, maxSizeBytes, maxWidth }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      try {
        // Calculate target dimensions — keep aspect ratio, max out at maxWidth
        let { width, height } = img
        if (width > options.maxWidth) {
          const ratio = options.maxWidth / width
          width = options.maxWidth
          height = Math.round(height * ratio)
        }

        // Create canvas at target size — this strips EXIF data automatically
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        // White background for JPEG (no alpha channel issues)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)

        // Draw image onto canvas — EXIF data is NOT carried over
        ctx.drawImage(img, 0, 0, width, height)

        // Try WebP first, fall back to JPEG
        const tryCompress = (mimeType: string, quality: number): Promise<Blob | null> => {
          return new Promise((resolve) => {
            canvas.toBlob(
              (blob) => resolve(blob),
              mimeType,
              quality
            )
          })
        }

        const compressIteratively = async () => {
          // Try WebP first
          const supportsWebP = await canvas.toBlob((blob) => !!blob, 'image/webp', 0.8)
          
          let mimeType = 'image/jpeg'
          if (supportsWebP) {
            mimeType = 'image/webp'
          }

          // Start at high quality, reduce until under size limit
          let quality = options.quality ?? 0.8
          let blob: Blob | null = null

          while (quality >= (options.minQuality ?? 0.3)) {
            blob = await tryCompress(mimeType, quality)
            if (blob && blob.size <= options.maxSizeBytes) {
              break
            }
            quality -= 0.1
          }

          // If still too large at minimum quality, use minimum quality result
          if (!blob || (blob.size > options.maxSizeBytes && quality < (options.minQuality ?? 0.3))) {
            blob = await tryCompress(mimeType, options.minQuality ?? 0.3)
          }

          if (!blob) {
            // Fallback to JPEG if WebP failed entirely
            blob = await tryCompress('image/jpeg', 0.5)
          }

          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }

          resolve(blob)
        }

        compressIteratively().catch(reject)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

// ============================================
// Upload with Progress (XMLHttpRequest)
// ============================================

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

interface UploadWithProgressOptions {
  url: string
  formData: FormData
  credentials?: RequestCredentials
  onProgress?: (progress: UploadProgress) => void
  timeout?: number // ms, default 60000
}

/**
 * Upload using XMLHttpRequest for progress events.
 * Returns parsed JSON response.
 */
export function uploadWithProgress<T = { ok: boolean; error?: string; data?: unknown }>(
  options: UploadWithProgressOptions
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const timeout = options.timeout ?? 60000

    xhr.timeout = timeout

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100)
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          percent,
        })
      }
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText) as T
        resolve(response)
      } catch {
        reject(new Error('Invalid response from server'))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error — check your connection'))
    }

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out — please try again'))
    }

    xhr.onabort = () => {
      reject(new Error('Upload cancelled'))
    }

    xhr.open('POST', options.url)

    if (options.credentials) {
      xhr.withCredentials = options.credentials === 'include' || options.credentials === 'same-origin'
    } else {
      xhr.withCredentials = true
    }

    xhr.send(options.formData)
  })
}

// ============================================
// Retry Logic
// ============================================

interface RetryOptions {
  maxRetries: number // default 2
  baseDelayMs: number // default 1000
  maxDelayMs: number // default 10000
  shouldRetry?: (error: unknown) => boolean
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
}

/**
 * Retry an async function with exponential backoff.
 * Returns the result on success, throws on final failure.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if shouldRetry returns false
      if (opts.shouldRetry && !opts.shouldRetry(error)) {
        throw error
      }

      // Don't wait after the last attempt
      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt),
          opts.maxDelayMs
        )
        // Add jitter (±25%) to avoid thundering herd
        const jitter = delay * 0.25 * (Math.random() * 2 - 1)
        await new Promise((r) => setTimeout(r, delay + jitter))
      }
    }
  }

  throw lastError
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    // Network errors
    if (msg.includes('network error') || msg.includes('fetch')) return true
    if (msg.includes('timed out') || msg.includes('timeout')) return true
    if (msg.includes('failed to fetch')) return true
    // Server errors — these come as parsed responses, but just in case
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true
  }
  return false
}

// ============================================
// Format helpers
// ============================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
