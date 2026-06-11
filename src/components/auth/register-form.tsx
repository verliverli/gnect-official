'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Check, X, Loader2, Lock, Shield, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/store'
import { COUNTRY_NAMES, getRegionsForCountry, getCountryFlag, ROLES } from '@/lib/constants'
import { toast } from 'sonner'
import { PasswordWarningGate, PasswordSuccessWarning } from '@/components/auth/password-warning'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

type BlockedState = null | 'vpn_detected' | 'country_blocked' | 'geo_error'


export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { setUser } = useAuthStore()
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [age, setAge] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [role, setRole] = useState('')
  const [street, setStreet] = useState('')
  const [cucumberSize, setCucumberSize] = useState('')
  const [showCucumber, setShowCucumber] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nickStatus, setNickStatus] = useState<NicknameStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountTimeRef = useRef(Date.now())

  // Blocked state for registration security gates
  const [blockedState, setBlockedState] = useState<BlockedState>(null)
  const [blockedMessage, setBlockedMessage] = useState('')

  // Password warning gates
  const [showPasswordWarning, setShowPasswordWarning] = useState(true)
  const [showPasswordSavedConfirmation, setShowPasswordSavedConfirmation] = useState(false)
  const [pendingUser, setPendingUser] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    mountTimeRef.current = Date.now()
  }, [])

  const checkNickname = useCallback(async (value: string) => {
    if (value.length < 3 || !/^[a-zA-Z0-9_]+$/.test(value)) {
      setNickStatus('invalid')
      return
    }
    setNickStatus('checking')
    try {
      const res = await fetch(`/api/auth/check-nickname?nickname=${encodeURIComponent(value)}`, { credentials: 'same-origin' })
      const data = await res.json()
      setNickStatus(data.available ? 'available' : 'taken')
    } catch {
      setNickStatus('idle')
    }
  }, [])

  const handleNickChange = (value: string) => {
    if (value.length > 6) return
    setNickname(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 3) {
      setNickStatus('idle')
      return
    }
    setNickStatus('checking')
    debounceRef.current = setTimeout(() => checkNickname(value), 400)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname || !password || !age || !country || !region || !role) {
      toast.error('Please fill in all required fields')
      return
    }
    const ageNum = Number(age)
    if (ageNum < 18 || ageNum > 120) {
      toast.error('Age must be between 18 and 120')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (nickStatus !== 'available') {
      toast.error('Please choose an available nickname')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        nickname,
        password,
        age: Number(age),
        country,
        region,
        role,
        website: '',
        startTime: mountTimeRef.current,
      }

      // Optional fields
      if (street.trim()) body.street = street.trim()
      if (cucumberSize && parseInt(cucumberSize) >= 1) body.cucumber_size = parseInt(cucumberSize)
      if (showCucumber) body.show_cucumber = true

      // Retry up to 2 times on server errors (cold start safeguard)
      let data: { ok?: boolean; user?: unknown; error?: string; token?: string; blocked?: string } = {}
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
        data = await res.json()

        // Handle security block responses
        if (data.blocked) {
          setBlockedState(data.blocked as BlockedState)
          setBlockedMessage(data.error || 'Registration blocked')
          setLoading(false)
          return
        }

        // If server error (500), wait and retry — cold start may not have loaded env yet
        if (res.status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500))
          continue
        }
        break
      }
      if (data.ok && data.user) {
        // Store token in localStorage for PWA (cookies may not persist)
        if (data.token) {
          localStorage.setItem('gnect_token', data.token)
        }
        // Don't set user immediately — show password saved confirmation first
        setPendingUser(data.user)
        setShowPasswordSavedConfirmation(true)
      } else {
        toast.error(data.error || 'Registration failed')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Warning 1: Before registration
  if (showPasswordWarning) {
    return <PasswordWarningGate onContinue={() => setShowPasswordWarning(false)} />
  }

  // Warning 2: After registration success
  if (showPasswordSavedConfirmation) {
    return (
      <PasswordSuccessWarning
        onEnter={() => {
          if (pendingUser) {
            setUser(pendingUser as any)
            toast.success('Account created!')
          }
        }}
      />
    )
  }

  // Blocked state — show friendly error with support links
  if (blockedState) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="min-h-screen bg-background flex items-center justify-center p-4"
      >
        <div className="max-w-sm w-full space-y-6 text-center">
          {/* Icon based on block type */}
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            {blockedState === 'vpn_detected' ? (
              <Shield className="w-8 h-8 text-destructive" />
            ) : (
              <MapPin className="w-8 h-8 text-destructive" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground">
            {blockedState === 'vpn_detected'
              ? 'VPN Detected'
              : blockedState === 'country_blocked'
              ? 'Not Available in Your Region'
              : blockedState === 'geo_error'
              ? 'Location Verification Failed'
              : 'Access Denied'}
          </h2>

          {/* Message */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {blockedMessage}
          </p>

          {/* Support info */}
          {(blockedState === 'country_blocked' || blockedState === 'vpn_detected' || blockedState === 'geo_error') && (
            <p className="text-xs text-muted-foreground">Think this is a mistake? Contact support in the app.</p>
          )}

          {/* Back to login */}
          <button
            type="button"
            onClick={() => setBlockedState(null)}
            className="text-sm text-muted-foreground gnect-transition hover:text-foreground"
          >
            ← Go back
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="min-h-screen bg-background"
    >
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={onSwitchToLogin} className="gnect-transition">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Account</h1>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Private. Anonymous. No email or phone needed.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Honeypot */}
          <input
            name="website"
            aria-hidden="true"
            tabIndex={-1}
            autoComplete="off"
            className="absolute opacity-0 h-0 w-0 overflow-hidden"
            style={{ position: 'absolute', left: '-9999px' }}
          />

          {/* Nickname */}
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <div className="relative">
              <Input
                id="nickname"
                placeholder="3-6 chars, letters/numbers/_"
                value={nickname}
                onChange={(e) => handleNickChange(e.target.value)}
                className="pr-10 h-11 rounded-xl"
                autoComplete="username"
                maxLength={6}
              />
              {nickStatus === 'checking' && (
                <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-muted-foreground" />
              )}
              {nickStatus === 'available' && (
                <Check className="absolute right-3 top-3 h-5 w-5 text-primary" />
              )}
              {nickStatus === 'taken' && (
                <X className="absolute right-3 top-3 h-5 w-5 text-destructive" />
              )}
              {nickStatus === 'invalid' && nickname.length >= 3 && (
                <X className="absolute right-3 top-3 h-5 w-5 text-destructive" />
              )}
            </div>
            {nickStatus === 'taken' && (
              <p className="text-xs text-destructive">Nickname is taken</p>
            )}
            {nickStatus === 'invalid' && nickname.length >= 3 && (
              <p className="text-xs text-destructive">Only letters, numbers, and underscores</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 h-11 rounded-xl"
                autoComplete="new-password"
                maxLength={50}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground active:bg-secondary transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10 h-11 rounded-xl"
                autoComplete="new-password"
                maxLength={50}
              />
              {confirmPassword && (
                <span className="absolute right-3 top-3">
                  {password === confirmPassword ? (
                    <Check className="h-5 w-5 text-primary" />
                  ) : (
                    <X className="h-5 w-5 text-destructive" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Age */}
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={18}
              max={120}
              placeholder="18+"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={(v) => { setCountry(v); setRegion(''); }}>
              <SelectTrigger className="w-full h-11 rounded-xl">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {COUNTRY_NAMES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {getCountryFlag(c)} {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={region} onValueChange={setRegion} disabled={!country}>
              <SelectTrigger className="w-full h-11 rounded-xl">
                <SelectValue placeholder={country ? "Select your region" : "Select country first"} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {country && getRegionsForCountry(country).map((r) => (
                  <SelectItem key={r} value={String(r)}>{String(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`h-11 rounded-full text-sm font-medium gnect-press gnect-transition border ${
                    role === r
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Divider — Optional */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground/50 font-medium">OPTIONAL</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Street / Area */}
          <div className="space-y-2">
            <Label htmlFor="street">Street / Area</Label>
            <Input
              id="street"
              placeholder="e.g. Al Sadd Street"
              value={street}
              onChange={(e) => { if (e.target.value.length <= 30) setStreet(e.target.value) }}
              className="h-11 rounded-xl"
              maxLength={30}
            />
            <p className="text-[10px] text-muted-foreground">Helps with proximity matching</p>
          </div>

          {/* Cucumber Size */}
          <div className="space-y-2">
            <Label htmlFor="cucumber">Size (inches)</Label>
            <Input
              id="cucumber"
              type="number"
              min={1}
              max={15}
              placeholder="1–15"
              value={cucumberSize}
              onChange={(e) => {
                const v = e.target.value
                if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 15)) {
                  setCucumberSize(v)
                }
              }}
              className="h-11 rounded-xl"
            />
            {/* Show on profile toggle */}
            <div className="flex items-center gap-3 mt-2">
              <Switch
                id="show-cucumber"
                checked={showCucumber}
                onCheckedChange={setShowCucumber}
              />
              <Label htmlFor="show-cucumber" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Show on my profile
              </Label>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full h-12 text-base font-semibold gnect-press gnect-transition"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary font-medium gnect-transition hover:underline"
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
    </motion.div>
  )
}
