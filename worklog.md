# NAREX Foods — iDe8 Flow Hub Build Worklog

Project: NAREX Foods restaurant commerce platform (Next.js 16, TypeScript, Tailwind 4, shadcn/ui, Prisma/SQLite).

Architecture adaptations for this sandbox (documented):
- Supabase PostgreSQL → Prisma + SQLite (db/custom.db) as the authoritative store; provider-neutral data layer.
- Supabase Auth → first-party credential auth: scrypt password hashing + HMAC-signed httpOnly session cookies.
- Supabase Storage → protected local uploads at db/uploads/ served only via authorized API endpoints.
- Single user-visible route `/` (SPA view router). All backend via API routes under /api/*.
- Paystack adapter implemented (init/verify/webhook with signature check) — disabled until keys configured.
- Zenobank adapter: intentionally inert until real merchant docs/credentials exist (spec §7).
- Google Apps Script email → notification outbox table + forwarder stub; ordering never blocked by email.

Task IDs:
- 1 Foundation (schema/seed) — owner: Z.ai Code
- 1-img Images — owner: Z.ai Code
- 2 Core libs — owner: Z.ai Code
- 3 Public APIs — owner: Z.ai Code
- 4 Admin APIs — owner: Z.ai Code
- 5-a Storefront UI — owner: subagent
- 5-b Admin UI — owner: subagent
- 6 App shell assembly — owner: Z.ai Code
- 7 QA + browser verification — owner: Z.ai Code

---
Task ID: 1
Agent: Z.ai Code (main)
Task: Foundation — Prisma schema, db push, seed

Work Log:
- Designed full Prisma schema: Setting, WebsiteContent/ContentRevision, Category/Product/ProductVariant/ProductAddOn, Order/OrderItem/OrderEvent, Payment/PaymentEvent, Coupon/CouponRedemption, Campaign, Role/StaffMember, DispatchProfile/DispatchAssignment, BlogPost, AuditEvent, NotificationOutbox
- Money stored as integer pesewas; separate order & payment state machines with explicit transition maps
- db:push successful (SQLite db/custom.db)
- Seed: exact spec §3 menu (4 products, exact prices GH₵20/25/30, jollof egg 25/chicken 35, rice balls 30), 11 roles, superadmin (admin@narexfoods.com / NarexAdmin2024!), settings defaults, home content (3 hero slides), coupons WELCOME10/NAREX5, welcome campaign, 1 blog post

Stage Summary:
- Database + seed ready. Key artifacts: prisma/schema.prisma, prisma/seed.ts
- IMPORTANT for next agents: prices are pesewas ints; permissions keys in src/lib/permissions.ts

---
Task ID: 3
Agent: Z.ai Code (main)
Task: Public APIs

Work Log:
- GET /api/bootstrap (settings+categories+products+active campaigns, degrades gracefully)
- POST/GET /api/orders — idempotent checkout (unique idempotencyKey), full server-side price recalculation via priceOrder(), coupon redemption transactional, manual Payment record created, WhatsApp URL built server-side (wa.me/233559291195), outbox notify; GET tracking requires reference+phone match
- POST /api/orders/[reference]/evidence — protected receipt upload (type/size/magic-byte validation, db/uploads/, sets awaiting_review; NEVER marks paid)
- POST /api/coupons/validate — server-side validation with real cart subtotal
- GET /api/payments/config; Paystack init/verify/webhook (HMAC SHA512 verify, amount+currency+ref matching, idempotent)
- GET /api/evidence/[paymentId] — staff with payments.review OR owner w/ ref+phone
- POST /api/auth/login|logout, GET /api/auth/me — scrypt + HMAC session cookie
- POST /api/campaigns/[id]/event; GET /api/content/[page]

Stage Summary:
- Contracts in src/lib/types.ts; shared serializers in src/lib/serialize.ts (serializeOrder, ORDER_INCLUDE)
- Order state machine: created→accepted|rejected|cancelled→preparing→ready→collected|dispatched→completed

---
Task ID: 4
Agent: Z.ai Code (main)
Task: Admin APIs

Work Log:
- GET /api/admin/overview — real persisted KPIs (revenueCollected = paid totals only; explicit definitions)
- /api/admin/orders GET (search/filter/paginate) + PATCH (state-machine transitions w/ reason, notes, cash mark-paid under payments.review, all audited)
- /api/admin/products GET/POST/PUT/DELETE (soft archive; variant/addon replace in tx); /api/admin/categories
- /api/admin/uploads — validated staff image uploads to public/images/uploads
- /api/admin/payments GET (review queue + reconciliation exceptions) + PATCH approve/reject (reviewer identity + reason recorded; Paystack manual override blocked)
- /api/admin/staff GET/POST/PATCH (invite w/ one-time token, activate/suspend, role assignment with escalation guard, password enrollment) + /api/admin/roles POST/PATCH
- /api/admin/dispatch GET(queue/assignments/mine)/POST(assign/unassign)/PATCH(lifecycle transitions; dispatchers only see own work) + /api/admin/dispatchers PATCH
- /api/admin/coupons, /api/admin/campaigns (CRUD + status + analytics counters)
- /api/admin/content GET/PUT(publish w/ revision history)/POST(rollback); structured JSON only, no arbitrary HTML/JS
- /api/admin/blog CRUD; /api/admin/reports GET json+csv (DB-side aggregation); /api/admin/settings GET/PUT/POST (outbox drain to EMAIL_BRIDGE_URL, bounded retries, secrets never stored/returned); /api/admin/audit; /api/admin/notifications

Stage Summary:
- Full API surface ready for UI. UI agents: consume src/lib/types.ts contracts; admin fetch uses same-origin /api/admin/* with cookie auth.

---
Task ID: 5-a
Agent: frontend subagent (storefront)
Task: Customer storefront UI — full SPA storefront (header/footer/views/cart/product modal/checkout/success/track/campaign popup) in src/components/storefront/

Work Log:
- Read worklog, types.ts, app-store.ts, client.ts, use-bootstrap.ts, settings.ts before writing any code.
- Created 17 files, all inside src/components/storefront/ (no other paths touched; no schema/API/store/lib/page/globals changes):
  - storefront-app.tsx — exports StorefrontApp(): owns useBootstrapData(), skip-link, header, view router (home/menu/checkout/success/track; returns null on 'admin' so the shell owns it), footer with mt-auto, CartSheet, ProductModal, CampaignPopup, sonner Toaster, loading skeleton + error state with retry.
  - header.tsx — sticky top-0 backdrop-blur bg-cream/85, UtensilsCrossed forest logo square + font-display brand + tagline (hidden sm), desktop nav (Home/Menu/Track), Staff Portal ghost button -> navigate('admin'), cart button with animated badge count (framer-motion spring pulse on change), mobile hamburger Sheet nav.
  - footer.tsx — bg-forest text-cream; brand col, quick links, contact (tel:, mailto:, wa.me WhatsApp button), opening hours from settings.hours (mon–sun), delivery areas chips, bottom row © + developerCredit; accepts className="mt-auto" so it sticks to viewport bottom on short pages and pushes down naturally on long ones.
  - hero-carousel.tsx — 6s auto-advance crossfade (AnimatePresence), pause on hover/focus + explicit pause/play button, prev/next arrows, dots, touch swipe (±40px), full prefers-reduced-motion support (no auto-advance, instant transitions); CTA maps ctaAction to known views else 'menu'.
  - home-view.tsx — hero (content home slides -> product-image fallback -> brand fallback), Featured Dishes (featured+available, fallback first 3), category chips -> navigate('menu',{category:id}), story section, How It Works on bg-forest with icon mapping, blog highlights (GET /api/blog, published only, silent failure), WhatsApp/call CTA band, today's-hours strip. GET /api/content/home normalized defensively (normalizeHomeContent) with sane defaults.
  - menu-view.tsx — search input (icon), Tabs (All + categories, id-keyed, reads params.category from home chips), count line, grid 1/2/3 cols, empty state with clear-search.
  - product-card.tsx — next/image fill aspect-4/3, group-hover image scale-[1.03] + shadow, Featured(Star gold)/Best seller(Flame forest) badges, sold-out overlay + disabled button, category + prepMinutes, "from GH₵X" lowest AVAILABLE variant, quick-add ONLY when 1 variant & 0 addons & available (toast with View-cart action), else "Customize & Order" opens modal.
  - product-modal.tsx — store-driven Dialog; gallery auto-rotate 4s with pause/play + prev/next + dots + touch swipe + reduced-motion; variant RadioGroup cards with prices (first available preselected), addon checkboxes with +price, qty stepper 1–50, dynamic total, Add to Cart -> addToCart + toast + close + open cart sheet; render-phase reset pattern (no setState-in-effect lint error).
  - cart-sheet.tsx — right Sheet; line items with variant + addon names, unit price incl addons, qty steppers, remove, subtotal (stale/archived products excluded); coupon apply via POST /api/coupons/validate (items + fulfillmentType pickup) -> discount line + sonner toasts; "Delivery fee calculated at checkout"; empty-cart state with browse button; checkout -> navigate('checkout') + close.
  - checkout-view.tsx — react-hook-form + zod (name≥2, phone /^[0-9+\s-]{9,15}$/, optional email regex, note≤500, superRefine: address required when delivery); RadioGroup fulfillment cards (pickup default; delivery disabled + note when !settings.delivery.enabled, address textarea + service-area badges + baseFee/freeOver shown); summary card: items, client subtotal, coupon input + revalidate, discount, delivery fee (free over threshold), TOTAL; idempotencyKey generated ONCE per mount (crypto.randomUUID) and reused across retries; submit POST /api/orders -> success: setLastOrder + clearCart + navigate('success'); 409 unavailable[] -> toast + bootstrap refresh; 409 orderingPaused -> toast; !settings.ordering.enabled renders pause notice card with call + WhatsApp buttons; empty-cart state.
  - success-view.tsx — spring CheckCircle2 (gold ring, forest icon), reference mono chip + copy button, status timeline from order.events, full itemized summary, primary gold "Send order on WhatsApp" <a target=_blank rel=noreferrer> with post-click notice "WhatsApp opened — your order is already saved with us. Reference: X", PaymentBox, Track order (params.reference) + Back home buttons; no-lastOrder empty state.
  - track-view.tsx — reference (auto-filled from params) + phone form -> GET /api/orders?reference=&phone=; 404 -> friendly inline error; result card: StatusBadge, StatusTimeline, items, total, PaymentBox (evidence upload if unpaid & manual enabled), prefilled "ask about this order" WhatsApp link.
  - payment-box.tsx (shared success/track) — GET /api/payments/config; manual details card (recipient/method/details/instructions); evidence upload (file input accept=image/*, phone auto-filled, XHR with real Progress bar) -> POST /api/orders/[ref]/evidence FormData{phone,file} -> 'awaiting review' amber state (never marks paid); Paystack "Pay by card" -> POST /api/payments/paystack/init -> authorizationUrl redirect, 409 -> fallback toast.
  - status-badge.tsx — order + payment status maps using amber/stone/forest/emerald palette (NO blue/indigo): created=secondary, accepted/collected/dispatched=forest, preparing=gold, ready/completed/paid=emerald filled, cancelled/rejected/failed=destructive, awaiting_review=amber, unpaid/pending=muted; humanize fallback.
  - status-timeline.tsx — vertical icon timeline (per-type lucide icons + tone), date-fns formatted, chronological.
  - campaign-popup.tsx — first placement='popup' campaign; opens after 1.2s; sessionStorage dismissal flag when showOnce; impression fired on open, click on CTA (navigate('menu') or external ctaUrl), dismissal on close without interaction; fire-and-forget with .catch.
  - storefront-lib.tsx — HomeContent types + normalizeHomeContent + defaults, lowestVariantPrice/cartUnitPrice pesewas helpers, apiErrorStatus/apiErrorBody (reads status/data attached by client.ts), PaymentsConfig type, usePrefersReducedMotion via useSyncExternalStore (no setState-in-effect), Reveal scroll animation, Eyebrow, SafeImage (branded fallback), BootstrapSkeleton, productAlt.
- Brand system: bg-cream page, bg-forest/text-forest, bg-gold/text-gold/border-gold, font-display headings, uppercase tracking-widest gold eyebrows, rounded-2xl cards shadow-sm hover:shadow-md — assumes Task 6 defines these tokens in globals.css.
- A11y: landmarks (header/nav/main/footer + skip link), aria-labels on all icon buttons, aria-current nav, focus-visible rings, 44px touch targets (min-h-11), sr-only file input, aria-live on qty/count, keyboard-operable carousel/modal controls, alt from product.altText.
- Quality: TypeScript strict, zero `any`, no console.log, all fetches via apiGet/apiSend with same-origin relative paths only, errors handled with toasts + inline states, custom thin scrollbars on long lists.
- Verification: `bunx tsc --noEmit` → 0 errors in storefront/* (remaining project errors are other agents' in-progress files); `bunx eslint src/components/storefront/**` → 0 problems (fixed 2 react-hooks/set-state-in-effect findings by switching to useSyncExternalStore + render-phase reset pattern).

NOTE for Task 6 (assembly): StorefrontApp mounts `<Toaster/>` (ui/sonner) itself — do NOT mount another sonner Toaster in the shell or toasts will duplicate. Mount StorefrontApp inside `min-h-screen flex flex-col`; the component brings its own flex-1 column + footer mt-auto. Brand tokens required in globals.css: bg-cream, bg-forest, text-forest, text-cream, bg-gold, text-gold, border-gold, font-display.

Stage Summary:
- Storefront UI complete: 17 files in src/components/storefront/, entry `StorefrontApp` in storefront-app.tsx, ready for page.tsx mount by Task 6.
- Contract adherence: bootstrap/content/blog/coupons/orders(409 unavailable+idempotency)/tracking/evidence/payments-config/paystack-init/campaign-event all consumed per spec; pesewas-only pricing via formatGHS.
- Deviations: (1) cart-sheet coupon validation sends fulfillmentType 'pickup' (cart has no fulfillment context; checkout revalidates with the chosen type); (2) Toaster mounted inside StorefrontApp to guarantee sonner delivery under current layout.tsx (radix Toaster) — integration should avoid a second sonner instance; (3) blog cards are display-only (no post detail view exists in the single-route SPA).

---
Task ID: 5-b
Agent: frontend subagent (admin)
Task: Admin dashboard UI — finishing verification: lint cleanup (react-hooks/set-state-in-effect + unused eslint-disable directives), final tsc/lint confirmation, worklog record

Work Log:
- Admin dashboard (15 files, all inside src/components/admin/ — built in the earlier 5-b session, verified and lint-fixed in this continuation):
  - admin-app.tsx — entry: exports AdminApp(); session gate via GET /api/auth/me into useAppStore.staff (loading spinner → LoginScreen → AdminProvider+AdminShell); injects BRAND_FALLBACK_CSS mirroring the storefront brand tokens until globals.css registers them.
  - admin-context.tsx — AdminProvider (active module + permission `can()` via permissions array) + useAdminApi() toast-bound `get/send/mutate` helpers (return null on failure, 403-friendly messages).
  - admin-shell.tsx — dashboard chrome: sidebar/topbar nav across the 10 modules (permission-gated), staff identity menu, "View storefront" via useAppStore.navigate("home"), logout via /api/auth/logout.
  - login-screen.tsx — email+password and email+one-time-invite-token enrollment flows against /api/auth/login.
  - admin-utils.tsx — MetaBadge + status badge maps (order/payment/payment-attempt/dispatch/staff/campaign/outbox/blog/availability; amber/green/teal/orange/violet palette, no blue/indigo), StatCard, skeletons, EmptyState, ConfirmDialog, errMessage, apiDelete, formatDate helpers, uploadImage (POST /api/admin/uploads), slugify/initials, PesewasInput (cedis↔pesewas).
  - overview-module.tsx — GET /api/admin/overview KPI cards + recharts trend/status pie + best sellers + alerts.
  - orders-module.tsx — debounced search/filter/paginated GET /api/admin/orders + detail dialog (timeline, PATCH state transitions with required reason, notes, cash mark-paid under payments.review).
  - menu-module.tsx — products+categories CRUD (variants/addons rows editor, image uploads to /api/admin/uploads, soft archive) via /api/admin/products & /api/admin/categories.
  - payments-module.tsx — review queue/all/exceptions tabs from GET /api/admin/payments; approve/reject PATCH with reviewer note; evidence image viewer.
  - staff-module.tsx — staff list + invite (one-time token) + activate/suspend/deactivate + role/department edits + password enrollment; roles & permissions matrix via /api/admin/roles.
  - dispatch-module.tsx — manager queue/assignments views, rider assignment (fee + note), assignment lifecycle PATCH with reason on failure, dispatcher profiles editor; dispatcher self-service "My deliveries".
  - marketing-module.tsx — coupons CRUD + activate toggle (/api/admin/coupons); campaigns CRUD + status workflow + impression/click/dismissal stats (/api/admin/campaigns).
  - content-module.tsx — home content editor (hero slides, story, how-it-works) with preview + publish + rollback revisions (PUT/POST /api/admin/content); blog editor with markdown + cover upload (/api/admin/blog).
  - reports-module.tsx — date-range presets, totals with tooltips (definitions per spec), charts, by-product/status/coupon breakdowns, CSV export via format=csv.
  - system-module.tsx — settings tabs (store/ordering, brand/contact/hours, payments manual+paystack) PUT /api/admin/settings; integrations status; notification outbox + drain (POST /api/admin/settings); audit log with filters.
- Lint cleanup (this session) — from `29 errors + 8 warnings` to `0 errors + 0 warnings`:
  - Removed all 8 stale `/* eslint-disable-next-line @next/next/no-img-element */` directives (content-module ×4, marketing-module ×1, menu-module ×2, payments-module ×1) — rule not active in this config.
  - Loaders: removed synchronous `setLoading(true)` from every fetch loader so no setState runs before the first await (13 sites: content ×2, dispatch ×3, marketing ×2, menu ×1, orders ×1, overview ×1, payments ×1, reports ×1, staff ×1, system ×2 — plus useSettings in system-module).
  - Discovered the react-hooks v6 rule flags `useEffect(() => { void load(); }, [load])` even when the useCallback loader awaits before setState (conservative cross-function analysis). Converted all 16 mount-fetch effects to the sanctioned inline cancelled-IIFE pattern: `useEffect(() => { let cancelled = false; (async () => { const res = await get(...); if (!cancelled) { ...setState...; setLoading(false); } })(); return () => { cancelled = true; }; }, [deps])` — with exhaustive-deps satisfied by listing real deps (e.g. [get, query], [get, tab, statusFilter, provider, page], [get, page, actionFilter], [get, from, to]).
  - orders/reports: `load` became unused → deleted (effect owns the fetch; orders reloads on query change, reports on date-range change). payments: effect inlined; kept a `refresh` useCallback for the Refresh button + post-decision reload.
  - Refresh buttons (overview, payments, dispatch ×3): moved the loading flag into the click handler (`setLoading(true)` in onClick is an event handler, allowed) so the spinner still spins on manual refresh; silent refetch elsewhere.
  - Dialog form hydration effects (BlogEditor, CouponEditor, CampaignEditor, ProductEditor, AssignDialog, DispatcherEditor, EditStaffDialog, PasswordDialog, InviteDialog, CreateRoleDialog): converted to the React-documented render-phase adjustment pattern with identity/tag keys (e.g. `if (initKeyNow !== initKey) { setInitKey(initKeyNow); if (initKeyNow !== null) { ...reset fields... } }`) — no effects, no lint suppressions.
  - system-module settings tabs (Store/Brand/Payments): replaced `hydrated` flag effects with settings-identity render-phase hydration; also fixed a real bug — useSettings() never fetched on mount (settings/integrations tabs would skeleton forever); added the mount fetch effect.
  - admin-utils PesewasInput: removed the value-sync effect entirely; `raw` is now derived (`draft ?? formatted`) with focus-scoped draft state.
  - Removed now-unused `useCallback` imports from orders-module and reports-module.
- Verification: `bunx eslint src/components/admin` → 0 errors, 0 warnings. `bunx tsc --noEmit | grep admin` → clean (no output). No rules disabled anywhere.

Stage Summary:
- Entry point: `AdminApp` exported from src/components/admin/admin-app.tsx. Integrator mounts it when useAppStore.view === 'admin' (StorefrontApp intentionally renders null on that view). Designed to be mounted inside the existing min-h-screen flex wrapper.
- Auth: AdminApp self-gates — GET /api/auth/me on mount → useAppStore.setStaff; unauthenticated renders LoginScreen (email+password or invite-token enrollment). All modules rely on cookie session for /api/admin/*; 403s render friendly toasts via errMessage.
- Navigation: admin → storefront via useAppStore.navigate("home") (admin-shell header/menu); storefront → admin via header Staff Portal button navigate("admin"). Module switching is internal AdminProvider state, not the store.
- TOASTER (critical for integration): AdminApp does NOT mount any Toaster — admin modules call `toast()` from sonner and rely on exactly ONE sonner <Toaster/> mounted in the app shell. StorefrontApp (Task 5-a) already mounts `<Toaster position="top-center" richColors closeButton />` from ui/sonner, so the integrator MAY rely on that single instance and must NOT mount a second one (duplicate toasts). If the shell unmounts StorefrontApp on the admin view, mount one Toaster in the shell instead and remove it from StorefrontApp — exactly one total.
- Brand tokens: admin expects bg-cream/bg-forest/bg-gold/text-forest/text-cream/text-gold/border-gold/font-display; AdminApp injects fallback CSS for these so the dashboard renders correctly even before Task 6 registers the tokens in globals.css (fallback can be deleted once tokens exist).
- Money: all admin money handling is integer pesewas via PesewasInput/formatGHS.
- ESLint/react-hooks: all admin fetch effects use the cancelled-inline-IIFE pattern with no synchronous setState before the first await; dialog forms re-initialize via render-phase key adjustment. Do not reintroduce `useEffect(() => { void load(); }, [load])` loaders — the v6 rule rejects them even when the loader awaits first.

---
Task ID: 1-img + 6
Agent: Z.ai Code (main)
Task: Food imagery + app shell assembly

Work Log:
- Generated 9 AI food images in public/images/: hero-1, hero-2 (1344x768), palava (regenerated), veg-stew, jollof-chicken, jollof-egg, rice-balls, rice-balls-2, brand-story
- globals.css: brand design system — @theme tokens (cream #FAF6EC, forest #17362B, gold #C9A227, forest-light, gold-soft, cream-dark), shadcn :root tokens re-skinned (primary=forest, ring=gold, warm ivory surfaces, forest sidebar), reduced-motion global support, custom scrollbars, font-display token
- layout.tsx: Playfair Display (--font-playfair), NAREX metadata (title/description/OG/twitter/robots), viewport themeColor, removed radix Toaster (sonner covers all)
- app-shell.tsx: single sonner Toaster + view switch (StorefrontApp | AdminApp), min-h-screen flex-col bg-cream wrapper
- page.tsx: JSON-LD Restaurant schema (exact menu prices) + AppShell
- storefront-app.tsx: removed its Toaster (shell owns single instance); admin-app.tsx: removed BRAND_FALLBACK_CSS (tokens now real)
- public/narex-logo.svg; metadataBase set
- tsc + eslint clean; dev server restarted on :3000, GET / 200, /api/bootstrap returns seeded data

Stage Summary:
- Assembled platform ready for browser QA. Images: hero uses /images/hero-1.png etc. (1440x720 rejected by API — used 1344x768)

---
Task ID: 7
Agent: Z.ai Code (main)
Task: QA + browser verification

Work Log:
- agent-browser E2E golden path verified: home (hero carousel, campaign popup WELCOME10, featured, story, how-it-works, footer sticky) -> menu (search/tabs/cards) -> product modal (variant With chicken GH₵35 + addon Fried plantain GH₵4, live total GH₵39) -> cart drawer (qty, coupon WELCOME10 -> -GH₵3.90) -> checkout (RHF+zod, pickup/delivery cards, coupon revalidated server-side, total GH₵35.10) -> order created NAR-RHNXP8LC (server recalc verified in DB: 3900-390=3510) -> success (reference, timeline, WhatsApp CTA, MoMo details, evidence upload w/ XHR progress -> awaiting_review; payment stayed Unpaid per spec)
- Order tracking via reference+phone works; unauthorized combos 404
- Admin: login (seeded superadmin), overview KPIs (real data: 1 order, pending verification 1, outstanding GH₵35.10, alerts), payments review queue -> evidence dialog (claimed vs total MATCH, protected image) -> approve w/ note + confirm -> order paid, audit trail complete; orders module accept transition (created->accepted) audited; menu/staff/dispatch/marketing/content/reports/system modules all render with real data; CSV export 401 unauthenticated, works with session
- Mobile (iPhone 15): header, drawers, hero, cards all responsive; fixed LCP warning (hero priority)
- tsc + eslint clean across src/; dev.log shows no runtime errors

Stage Summary:
- ALL DONE. Platform is browser-verified and production-shaped. Seeded admin: admin@narexfoods.com / NarexAdmin2024!

---
Task ID: 8
Agent: Z.ai Code (main)
Task: Hydration fix + superadmin auth hardening + absolute dashboard + checkout pinned map + food varieties + auto carousels + Services/Parlays/Eat&Tour pages + Eat&Tour popup + exact links + PWA webapp

Work Log:
- HYDRATION FIX (reported console error: Sheet aria-controls radix-_R_* mismatch): root cause = zustand persist rehydrated cart synchronously at module init → header cart badge rendered on client but not server → Radix useId tree shifted. Fix: `skipHydration: true` in app-store persist + `useAppStore.persist.rehydrate()` in an effect inside app-shell (post-paint). Browser-verified: seeded persisted cart + reload → zero hydration errors, badge appears with animation.
- AUTH HARDENING (superadmin dashboard menus/tabs): (1) admin-app gate now distinguishes definitive 401 (clears stale staff → login) from network/5xx errors (retry screen, session preserved) — previously ANY error logged the user out visually; (2) useAdminApi get/send/mutate intercept 401 globally → clears store staff + "Your session has expired" toast → shell returns to LoginScreen instead of broken menus/tabs full of 401 toasts (browser-verified via cookie clear); (3) "Refresh dashboard" → window.location.reload() (real session re-verification); login re-verified working.
- ABSOLUTE DASHBOARD + DEEP LINKS: new src/lib/hash.ts (parseHash/buildHash). All views reachable as /#/view?params (e.g. /#/admin/orders, /#/menu?category=x, /#/track?reference=y). navigate() pushStates the hash; app-shell bootstraps from hash on load + hashchange listener for back/forward (browser-verified). Admin module state moved into app store (adminModule) so /#/admin/<module> syncs both ways; AdminProvider reads store.
- CHECKOUT PINNED MAP: new storefront/delivery-map.tsx — OpenStreetMap embed iframe (no API key) with marker at kitchen pin (Mampong-Akuapem), debounced Nominatim geocode moves pin to typed address (countrycodes=gh), status captions (idle/locating/found/approx), pulsing gold pin overlay, service-area badges, "Open in Google Maps" link. Gracefully offline-safe (falls back to kitchen pin + advice caption) — verified live in sandbox (nominatim unreachable → approx caption shown).
- FOOD VARIETIES SINGLED OUT + ALL AS ONE: home new "Food varieties" section — one image card per category (hero dish photo, live dish count, sample dish, exact link navigate('menu',{category:id})) + "All varieties in one menu" CTA; menu page adds variety spotlight strip (per-category photo tiles + "Everything, as one" tile) above search/tabs.
- AUTO SMOOTH CAROUSELS + MODAL TRANSITIONS: product-card now crossfade-auto-rotates images (3.4s, pauses on hover/focus, reduced-motion aware, photo-count pill + dots); product-modal gallery direction-aware slide+crossfade (state-based direction, no refs in render), details column entrance animation.
- NEW PAGES: services-view (catering/corporate/meal-plans/parlays cards with exact CTAs: prefilled WhatsApp briefs + exact category deep links), parlays-view (3 curated packs, live "from" prices, exact product chips opening real modals), eatntour-view (4 tasting stops each linking to the EXACT menu dish modal, 3 priced tour packages with WhatsApp booking briefs, know-before-you-go). 3 AI hero images generated (eatntour/services/parlays).
- EAT & TOUR POPUP AD: eatntour-promo.tsx — once-per-session (sessionStorage), 7s delay, CTA → navigate('eatntour'); campaign-popup CTA now also supports internal "#/..." URLs for exact links.
- EXACT LINKS EVERYWHERE: hero-carousel CTA resolver supports "product:<id>" (opens exact dish modal), "category:<id>" (exact variety), "#/view" deep links; featured/varieties/parlays/eatntour all link to exact targets; only generic buttons go to general menu.
- COPYWRITING: upgraded featured section, CTA band, menu intro copy; full marketing copy on 3 new pages.
- PWA WEBAPP: public/manifest.webmanifest (standalone, shortcuts to Menu/Track/Eat&Tour), narex-icon.svg + narex-maskable.svg, public/sw.js (NETWORK-FIRST for everything incl. /_next/static — cache-first on Turbopack's path-hashed dev chunks served stale code; API + cross-origin bypassed), layout metadata (manifest, appleWebApp, icons). SW verified registering (v2 activated). NOTE: old v1 SW + Cache API must be unregistered once per browser (done in test sessions).
- Fix: eatntour stop labels truncate cleanly (shortDishName, no dangling "Yam /").
- Verification: agent-browser E2E — hydration regression test clean, home/varieties/menu deep-link filter/product modal (variant+addon total)/cart/checkout map/one-tap delivery order NAR-FYG335RV → success; services/parlays/eatntour render; admin login, all 10 menus, payments tabs, orders data, 401 expiry → friendly toast + login; back/forward hash routing; mobile (iPhone 15) nav sheet + layout; footer 0-gap sticky/push; tsc 0 src errors; eslint 0 problems; dev.log clean.

Stage Summary:
- All reported issues fixed and requested features shipped. Entry points unchanged (single / route, AppShell). New views: services, parlays, eatntour (store View union + NAV + footer links).
- GOTCHA for future agents: public/sw.js is network-first BY DESIGN (Turbopack dev chunks are path-hashed; never introduce cache-first for /_next/*). Bump CACHE name when changing sw.js. Old-session caches: unregister SW + caches.delete (test sessions already cleaned).
- Seeded admin unchanged: admin@narexfoods.com / NarexAdmin2024!
