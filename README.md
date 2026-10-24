# NAREX Foods — Eat & Tour commerce platform

> GOOD FOOD. GREAT TASTE. MADE WITH CARE.
> Mampong-Akuapem, Ghana · WhatsApp 0559291195 · Prices in Ghana cedis (GH₵)

Production-shaped restaurant commerce webapp: ordering, catering quotations, gifting,
delivery zones, payments review, staff RBAC, content management and analytics.
Attribution: engineered by iDe8 Flow Hub.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript strict
- Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons
- Prisma ORM + SQLite (`db/custom.db`) — money stored as integer pesewas
- First-party credential auth (scrypt + HMAC-signed httpOnly cookies) for staff AND customers
- Zustand (client state) with `skipHydration` (SSR-safe), hash-based SPA routing on a single `/` route

## Quick start

```bash
bun install
cp .env.example .env          # fill AUTH_SECRET for production
bun run db:push               # sync prisma/schema.prisma → SQLite
bun prisma/seed.ts            # seed menu, zones, roles, admin, coupons, content
bun run dev                   # http://localhost:3000 (dev only)
```

Seeded superadmin: `admin@narexfoods.com / NarexAdmin2024!` (change immediately in production).

## Feature map

| Area | Where |
|---|---|
| Storefront (menu, cart, checkout, tracking) | `src/components/storefront/*` — single route `/#/<view>` |
| Admin dashboard (12 modules) | `src/components/admin/*` — `/#/admin/<module>` |
| Public APIs | `src/app/api/*` (orders, zones via bootstrap, currency, catering quotes, account) |
| Admin APIs | `src/app/api/admin/*` (orders, menu, payments, quotes, zones, staff, content, settings, reports, audit) |
| Business rules | `src/lib/orders.ts` (pricing), `zones.ts` (fees), `currency.ts` (rates), `auth.ts`/`customers.ts` (sessions) |

### Ordering rules (enforced server-side, never trusted from the client)

- Prices re-computed from DB truth on every order; client totals ignored.
- Palava/Veg-stew meals: exactly one staple + one portion; jollof egg vs chicken are distinct variants.
- Delivery requires a **confirmed location** (map card → Confirm dialog) and a matching **delivery zone**
  (`DeliveryZone` rows: fee, minimum order, lead time, requires-quote flag for long-distance e.g. Accra).
- Gift orders carry recipient name/phone/message + optional price hiding; purchaser pays, recipient never re-pays.
- Coupons validated + redeemed transactionally; idempotency key prevents duplicate orders.

### Payments

- Manual mobile-money transfer + receipt upload → staff review queue (`payments.review`) — receipts never auto-approve.
- Paystack adapter (init/verify/webhook with signature check, amount match, idempotency) — disabled until keys configured.
- Zenobank: intentionally inert until official merchant documentation exists.

### Currency

- Canonical currency: **GHS** for all pricing, totals and charges.
- Optional display estimates (USD/GBP/EUR/NGN/CAD) from open.er-api.com, cached in `CurrencyRate`,
  labeled `est.` — enable in Admin → System → Currency. Stale/missing rates fall back to GHS-only.

### Notifications

- All transactional email goes through the `NotificationOutbox` table (retryable, never blocks ordering);
  drain via Admin → System, or configure `EMAIL_BRIDGE_URL` (Google Apps Script) to automate.

## Operations

- **Backups**: copy `db/custom.db` (SQLite single-file) — schedule off-hours; restore = stop server, replace file, restart.
- **Migrations**: edit `prisma/schema.prisma` → `bun run db:push` (dev). For production, use `bun run db:migrate` and review SQL first.
- **Health check**: `GET /api` returns `{ ok: true }`; `GET /api/bootstrap` returns the full public payload.
- **PWA**: manifest + network-first service worker (`public/sw.js`) — bump the CACHE name when changing sw.js.
- **Logs**: dev server writes to `dev.log` in development.

## Security notes

- Session cookies are HMAC-signed, httpOnly, SameSite=Lax; staff and customer cookies are separate.
- `AUTH_SECRET` is required in production (boot guard). Never expose provider secrets to the client —
  admin settings strip secret fields before they reach the browser.
- Rate limiting on login, checkout, tracking, evidence upload, quotes and campaign events.
- Protected uploads (receipts) are served only to authorized reviewers or the order owner (ref+phone).
- All privileged actions are recorded in `AuditEvent`.
