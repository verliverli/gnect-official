# Task 1-2-3-9: Country Pivot + Remove Telegram + App Guide Update

## Agent: full-stack-developer

## Summary
Completed the major GNECT pivot from Gulf/Poland to Tanzania/Kenya, removed all Telegram MiniApp dependencies, and updated the app guide to promote PWA installation.

## Files Modified
1. `src/lib/constants.ts` — COUNTRIES replaced (Tanzania+Kenya), SUPPORT_CHANNELS emptied
2. `src/lib/geo-check.ts` — TARGET_COUNTRIES updated (TZ/KE)
3. `src/app/layout.tsx` — Removed Telegram SDK script, updated description meta
4. `src/components/auth/register-form.tsx` — Removed Telegram initData, blocked states, support links
5. `src/app/api/auth/register/route.ts` — Removed Telegram GATE 1, telegramInitData, TELEGRAM_BOT_TOKEN, supportChannels
6. `src/components/app-guide.tsx` — Replaced Telegram Mini App section with PWA Install section, updated Privacy First callout, updated Disguise & Stealth section

## Files Deleted
1. `src/lib/use-telegram.ts`
2. `src/lib/telegram-verify.ts`

## Files Preserved
- `src/lib/telegram-notifications.ts` — Media bot, NOT MiniApp related
- `src/components/support/support-screen.tsx` — Gracefully handles empty SUPPORT_CHANNELS
- `src/components/admin/admin-support.tsx` — Gracefully handles empty SUPPORT_CHANNELS

## Verification
- ESLint passes with zero errors
- Dev server compiles and starts successfully
