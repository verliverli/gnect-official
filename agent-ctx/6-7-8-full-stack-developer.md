# Task 6-7-8 — full-stack-developer

## Task: Glass-like Notifications + Install App Guide + In-App Support Enhancement

### Work Completed

#### TASK 6: Glass-like Notifications Enhancement
- Added `backdrop-blur-sm` to notification item rows
- Added `backdrop-blur-sm border border-primary/20` to unread notification icon container
- Changed settings panel wrapper from `bg-card` to `bg-card/80 backdrop-blur-sm`
- File: `src/components/notification-center.tsx`

#### TASK 7: Install App / Get GNECT App
- Created `src/components/install-guide.tsx` — full-screen overlay with Android/iOS/Desktop instructions
- Added Install App button to profile-panel.tsx after Privacy section
- Added `showInstallGuide` state + AnimatePresence overlay
- Added `Download` icon import and `InstallGuide` component import
- Files: `src/components/install-guide.tsx` (new), `src/components/profile-panel.tsx`

#### TASK 8: In-App Support Enhancement
- Removed Telegram channel reference block from support-screen.tsx
- Added collapsible FAQ section with 5 questions
- Removed unused imports: `SUPPORT_CHANNELS`, `getCountryFlag`, `ExternalLink`
- Removed `userCountry` and `countryChannel` variables
- File: `src/components/support/support-screen.tsx`

### Verification
- Lint: 0 errors, 1 warning (CF Worker script — expected)
- Dev server: running cleanly
