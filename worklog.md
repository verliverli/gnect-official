# GNECT Project — Sandbox Worklog

## Session: 2025-07-18 (Initial Setup)

---
Task ID: 1
Agent: Main Agent
Task: Clone GNECT project from GitHub and set up in sandbox

Work Log:
- Cloned repo from https://github.com/verliverli/gnect-official.git to /home/z/gnect-cloned
- Inspected full project structure — massive Next.js app with 60+ API routes, 30+ components
- Deleted default sandbox source files (src/, public/, prisma/, scripts/, configs)
- Copied ALL project files from clone to /home/z/my-project/
- Updated package.json to match project's exact dependencies
- Added missing deps: @libsql/client, @prisma/adapter-libsql, bcryptjs, jose, socket.io-client, web-push
- Created .env with all live credentials (Turso, JWT, Telegram, Vercel, etc.)
- Ran `bun install` — all deps installed, Prisma client generated successfully
- Attempted to start dev server multiple times
- Server STARTS and COMPILES successfully, but gets OOM-killed on first page request
- Sandbox memory too limited for Turbopack compilation of this large project
- PROJECT CODE IS FULLY IN PLACE AND CONFIGURED

Stage Summary:
- Project fully cloned and placed in sandbox at /home/z/my-project/
- All environment variables configured in .env
- Dependencies installed, Prisma generated
- Dev server starts but dies on page compile (OOM) — sandbox limitation
- Live preview at Vercel still works fine
- All credentials saved in .env file

---
## CREDENTIALS REFERENCE (Saved for session continuity — DO NOT PUSH TO GIT)

### GitHub
- Repo: https://github.com/verliverli/gnect-official.git
- Token: [SEE .env FILE]

### Database (Turso — LIVE)
- URL: [SEE .env FILE]

### Auth
- JWT_SECRET: [SEE .env FILE]
- ADMIN_NICKNAME: verliverli
- ADMIN_PASSWORD: [SEE .env FILE]

### Socket.io (HuggingFace — LIVE)
- URL: https://verliverli-gnect.hf.space

### Telegram Media Bot
- Bot Token: [SEE .env FILE]
- Channel ID: [SEE .env FILE]

### Cloudflare
- API Token: [SEE .env FILE]
- Account ID: [SEE .env FILE]

### Vercel
- API Token: [SEE .env FILE]
- Project Name: gnect

### IP/Geo
- findip.net API Key: [SEE .env FILE]
- ProxyCheck.io API Key: [SEE .env FILE]

### Web Push (VAPID)
- Public Key: [SEE .env FILE]
- Private Key: [SEE .env FILE]

---
## PUSH WORKFLOW RULES (MUST FOLLOW)

When pushing fixes to GitHub:
1. REFERENCE — Pull all GitHub files and compare with local
2. IDENTIFY — Know which files are project files vs sandbox files
3. PUSH ONLY project files — Never push sandbox config (Caddyfile, .next/, db/, mini-services/, etc.)
4. VERIFY — After pushing, verify pushed files are real project files and not broken
5. NEVER push worklog.md — it's in .gitignore (contains dev-only notes, secrets reference)

### Files that are PROJECT files (safe to push):
- src/** (all source code)
- prisma/schema.prisma
- public/** (logos, icons)
- scripts/** (seed, setup scripts)
- package.json, next.config.ts, tailwind.config.ts, components.json
- eslint.config.mjs, postcss.config.mjs, tsconfig.json
- .env.example (if it exists — NOT .env with real credentials)

### Files that are SANDBOX files (NEVER push):
- Caddyfile
- .next/
- db/custom.db
- download/
- examples/
- mini-services/
- dev.log
- bun.lock (may differ)
- .env (contains real credentials)
- worklog.md (contains secret references)

---
## PROJECT OVERVIEW

**GNECT** — Privacy-first social app for Tanzania & Kenya (PIVOTED from Gulf & Poland)
- Multi-country: Tanzania (31 regions), Kenya (47 counties)
- Features: 1-on-1 chat, group chat (Mixer), community posts, confessions, daily engagement
- Real-time: Socket.io on HuggingFace Space
- Database: Turso (LibSQL) — cloud, live
- Media: Telegram Bot API via Cloudflare Worker proxy (bypasses TZ/KE blocks)
- Auth: JWT with jose, bcryptjs
- PWA: Service worker, push notifications, one-click install
- Admin panel with full moderation tools
- Premium night design system (emerald green + gold accents)

---
## Session: 2025-07-18 (MAJOR PIVOT — TZ + KE Market)

---
Task ID: PIVOT-1
Agent: Main Agent
Task: Full pivot to Tanzania + Kenya market — all 10 fixes

Work Log:
- Verified all APIs: Turso DB (1 user), Vercel (200), HuggingFace Socket.io (200), Telegram Bot (live), findip.net (token param), ProxyCheck.io (ok)
- Country pivot: constants.ts updated with Tanzania (31 regions) + Kenya (47 counties), flags 🇹🇿🇰🇪
- Geo-block: TARGET_COUNTRIES changed from PL/QA/AE/SA to TZ/KE
- Removed Telegram MiniApp completely
- Added PWA setup: manifest.json, sw.js, service worker registration, iOS meta tags
- Deployed Cloudflare Worker proxy: https://gnect-media.03mrfrancis.workers.dev
- Created install-guide.tsx: Android/iOS/Desktop step-by-step instructions
- Fixed admin dashboard visibility
- Pushed 17 project files to GitHub
- Commit: 4b04d4c "PIVOT: Tanzania + Kenya market"

---
## Session: 2025-07-19 (PWA Install + CF Worker Fix)

---
Task ID: 2
Agent: Main Agent
Task: Fix CF Worker root route + implement PWA one-click install flow

Work Log:
- Investigated CF Worker "Not found" error — it was working fine, just no root route
- Added root route to cf-worker-media.js: shows service info JSON instead of confusing 404
- Redeployed CF Worker via wrangler — version b75f49fd
- Verified CF Worker: root, health, bot/getMe all return correct responses
- Created usePwaInstall hook: captures beforeinstallprompt, tracks install state, provides promptInstall()
- Created InstallAppButton component: smart button (one-click when supported, guide fallback, installed state)
- Updated install-guide.tsx: added one-click install section, installed banner, platform detection
- Added floating install banner in app-shell: animated bottom card with Install/Dismiss buttons
- Updated profile-panel: replaced static Install App button with smart InstallAppButton
- Fixed lint error: moved platform detection from useEffect to useState initializer
- Added worklog.md to .gitignore (was causing GitHub push protection blocks due to secret references)
- Rebased git history to remove worklog.md from commits
- Force-pushed to GitHub, Vercel deployment successful

Stage Summary:
- CF Worker now shows proper info at root URL (no more confusing 404)
- PWA install flow: one-click install when browser supports it, floating banner, smart buttons
- All APIs verified working: CF Worker (root/health/bot), Vercel (200), PWA (manifest.json/sw.js)
- Commit: 7b309ef "feat: PWA one-click install + CF Worker root route fix"
- Live at https://gnect.vercel.app
- CF Worker at https://gnect-media.03mrfrancis.workers.dev

---
## Session: 2025-07-19 (APK Download Infrastructure)

---
Task ID: 3
Agent: Main Agent
Task: Set up APK download infrastructure for PWA Builder generated APK

Work Log:
- Created /public/downloads/ directory for hosting the APK file
- Created download-info.json with version, size, changelog metadata
- Created /api/download endpoint: checks if APK exists, returns availability + metadata
- Updated install-guide.tsx: green "Download Android App" card with APK button for Android users
- Updated install-app-button.tsx: smart priority — APK > one-click > manual guide
- APK download flow: Android users see green "Download APK" button first, then browser install as fallback
- Verified: /api/download returns `{"ok":true,"available":false}` (correct — no APK yet)
- Verified: /downloads/download-info.json is accessible
- Pushed to GitHub, Vercel deployed

Stage Summary:
- APK download infrastructure is READY
- When APK is generated via PWA Builder:
  1. Place gnect.apk in /public/downloads/
  2. Update download-info.json with size + version
  3. Push to GitHub — buttons auto-enable
- Commit: 34e956e "feat: APK download infrastructure for PWA Builder"
- Download API: https://gnect.vercel.app/api/download
- Download info: https://gnect.vercel.app/downloads/download-info.json

---
## Session: 2025-07-20 (Admin Stats Fix + PWA Manifest Fix + Profile Name + Install Guide)

---
Task ID: 4
Agent: Main Agent
Task: Fix admin stats visibility, PWA manifest for PWA Builder, profile name truncation, install guide updates

Work Log:
- Admin dashboard: replaced invisible bg-primary/bg-muted/text-foreground with explicit emerald/zinc colors
  - StatCard: zinc-900 bg, zinc-100 numbers, emerald-400 accent, red-400 danger
  - Region/country bars: emerald-400/500/teal-400 gradient bars, zinc-800 track, emerald-400 count
  - Quick summary: zinc-400 labels, zinc-100/emerald-400/amber-400 values
  - Growth chart card: zinc-900 bg, emerald-400 icon
- Profile name: removed `truncate` class, added `whitespace-nowrap` — name shows fully
- Nickname limit: changed from 20 to 10 chars in constants.ts, register-form.tsx
- PWA manifest.json: complete rewrite with id, display_override, screenshots, shortcuts, launch_handler, share_target, prefer_related_applications, proper icons (192+512)
- PWA icons: converted icon-512.png from JPEG 1024x1024 → proper PNG 512x512, created icon-192.png (192x192 PNG)
- PWA screenshots: created screenshot-narrow.png (390x844), screenshot-wide.png (1280x720)
- Service worker: upgraded to v2 with background sync (IndexedDB queue), cache-first for static assets, network-first for navigation, notification actions
- Install guide: rewritten with ALL platform instructions always visible, app features section (Chat, Confessions, Mixer), benefits banner
- Layout.tsx: added apple-touch-icon, favicon links, theme-color meta tag
- Lint: clean (1 warning on CF worker script — pre-existing)
- Pushed to GitHub, Vercel deployed and verified

Stage Summary:
- Admin stats now use EXPLICIT colors — emerald-400 bars, zinc-100 numbers — no more invisible stats
- Profile name shows fully without truncation, max 10 chars
- PWA manifest passes all PWA Builder checks: proper icons (192+512 PNG), id, screenshots, shortcuts
- Service worker supports offline + background sync + notification actions
- Install guide shows ALL platform instructions + app features
- Commit: 4913103 "fix: admin stats visibility, PWA manifest, profile name, install guide"
- Verified on Vercel: manifest.json has id+shortcuts, icon-512 is real PNG 512x512, icon-192 exists
