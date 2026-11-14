# BUYKUB Navigation Implementation Plan

> **For agentic workers:** Apply focused implementation and test/review each owned domain; root integrates and deploys.

**Goal:** Editable My Shop home, unified purchases and Analytics, reduced Settings.
**Architecture:** Keep compatible URLs, owner-only management over shared storefront presentation; server-only purchase lookup; request-scoped seller reads.
**Tech Stack:** Next.js 16.4.6 / React 19 / Supabase / Vercel.
**Spec:** docs/superpowers/specs/2026-11-12-navigation-design.md

## Global Constraints
- Preserve dirty workspace, no commits, migrations or external changes by workers.
- Read installed Next.js docs before writing code.
- No shared caches for orders/account/paid lessons; authoritative auth and course entitlement remain.
- Four exact labels: ร้านค้าของฉัน, รายการที่สั่งซื้อ, Analytics, ตั้งค่า.
- Links for old dashboard/products/orders/learn entry points keep working.

## Review Focus
- New seller without shop can create one in My Shop without payout dependency.
- Appearance saves never overwrite payout; payout saves never overwrite appearance.
- Buyer email comparison never accepts unverified metadata or wildcard matches.
- Refund/expiry entries cannot grant downloads or learning; old receipts remain protected.
- Customer preview excludes drafts and editing controls; managing never counts as public analytics visit.

### Task 1: My Shop and reduced Settings
Files: products/page + new MyShop client editor; settings form/page; shared storefront components/public shop page if necessary.
- [x] Add tests for manage default/customer preview and field-separated saving; run red.
- [x] Build editable storefront with image upload/name/bio/accent/link settings and existing product actions/new product controls. Move shop creation here.
- [x] Keep Settings payout-only, with explicit owner/shop scoped update.
- [x] Run focused tests and report changed files/results.

### Task 2: Consolidated Analytics
Files: analytics/page + helpers/tests; orders/page redirect; overview components reusable.
- [x] Add revenue/refund/range tests; run red.
- [x] Combine overview, events/chart, paid summary/payout estimates, incoming orders in one page without duplicate full order reads.
- [x] Redirect old orders list; preserve order detail.
- [x] Run focused tests.

### Task 3: Purchase Library
Files: learn/page, new lib/purchases server service + tests, CourseReader return copy.
- [x] Test owner-ID/confirmed exact legacy email access and rejection of other/unverified/refunded content.
- [x] Implement server-only safe projection, library for course/file/key history using existing receipt/course routes; empty/error states.
- [x] Run focused tests.

### Task 4: Navigation and authenticated homepage
Files: DashboardNavigation/LayoutContent, dashboard/page, auth redirect, proxy/middleware, ProfileMenu, entry copy/tests.
- [x] Test four-menu labels, active order detail under Analytics and authenticated home redirect with guest unaffected.
- [x] Implement navigation and redirect compatibility; preserve cache/no-store and cookies.
- [x] Run focused tests, full suite, type/build/lint, independent review.

### Task 5: Release verification
- [x] Production build, preview deployment, verify core pages and authorization.
- [x] Promote, verify live My Shop editing/preview, Analytics and purchase library, logged-in/guest home routing.
- [x] Record proof screenshot and final test/limits; no real purchase.


Release result: dpl_29g7njjeQv8ma5WFx3ujiE5614Y9 promoted to buykub.com (sin1). 383 tests / 90 files pass, lint pass, local webpack production build pass, final Vercel default Turbopack build + TypeScript pass. Local Turbopack cannot bind its CSS worker port in this environment; no project configuration workaround needed. Independent scoped review found no blockers.

Browser evidence: local authenticated My Shop manage/customer toggle, editor fields, payout-only Settings, empty purchase library and Analytics paid/refund filters. Live My Shop bio was temporarily changed, saved, reloaded, and restored; public HTML confirms original bio and no test marker. Live signed-in root redirects to My Shop; old orders list redirects to Analytics#orders; fee5% shown; purchase library shows expected empty state for the seller Google account. Guest home200, guest purchases307. No new payments, refunds, migrations or access grants. Nonempty purchase variants and access edge cases covered by tests, not a new live purchase.

Ruling: correct the inherited overview8% estimate to stated platform5% in published Terms/Settings; clearly estimate platform fee only, not processing/net settlement.
