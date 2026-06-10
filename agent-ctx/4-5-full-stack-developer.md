# Task 4-5: CF Worker Proxy + PWA Setup

## Agent: full-stack-developer

## Summary

Completed both Task 4 (Cloudflare Worker proxy for Telegram Bot API) and Task 5 (PWA setup).

### Task 4: Cloudflare Worker Proxy

- **Worker script**: `scripts/cf-worker-media.js` — ESM module with routes for `/health`, `/file/:path`, `/bot/:method`
- **Deployment**: Used multipart/form-data upload with `application/javascript+module` content type (plain `application/javascript` doesn't support ESM `export default`)
- **Secret binding**: BOT_TOKEN stored as Cloudflare secret_text binding in deployment metadata
- **Worker URL**: `https://gnect-media.03mrfrancis.workers.dev` (subdomain is `03mrfrancis`)
- **Verification**: Health check returns `{"ok":true}`, bot proxy `/bot/getMe` returns correct bot info
- **constants.ts updated**: `TELEGRAM_MEDIA.API_BASE` now points to CF Worker, `DIRECT_API_BASE` kept as fallback

### Task 5: PWA Setup

- **manifest.json**: Created at `public/manifest.json` with standalone display, dark theme, icons
- **sw.js**: Created at `public/sw.js` with full PWA functionality (caching, push, notification click)
- **Route handler**: Updated `src/app/sw.js/route.ts` with same full PWA code (takes precedence in dev)
- **layout.tsx**: Added manifest link, iOS PWA meta tags, service worker registration script
- **.env**: Added `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for client-side push subscription

### Key Technical Details

- The CF Worker subdomain is `03mrfrancis` (not `verliverli` as initially expected)
- Route handler at `src/app/sw.js/route.ts` serves the SW in dev mode to avoid Next.js dev server crash with static SW files
- `public/sw.js` exists for production builds
- Lint passes (0 errors, 1 warning on CF Worker script — expected)
