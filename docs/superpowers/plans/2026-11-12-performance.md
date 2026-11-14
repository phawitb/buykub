# BUYKUB performance implementation plan

**Goal:** Faster public pages and fewer redundant authenticated reads, verified before/after on buykub.com.
**Authorization/spec:** User explicitly requested cache, duplicate-query reduction, comparative testing and production deployment. Prior design discussion accepted; no further approval needed. Preserve dirty shared workspace and all existing behavior. No commit requested.
**Architecture:** Static landing page with a client-side account menu. Anonymous-only public catalog Data Cache (60 seconds), invalidated after seller mutations. Request-scoped React cache for verified user and seller shop, never persistent private data. Live stock, payment and course access checks stay uncached. Keep current region until database location is verified.
**Stack:** Next.js 16.4.6 / Supabase / Vercel. Installed fetch, unstable_cache, connection and revalidateTag docs read. Use unstable_cache for existing non-Cache-Components app without a broad rendering migration.

## Tasks
- [x] Record repeatable production baseline (home/product/shop); preserve results in artifacts.
- [x] Test then implement static landing and non-blocking auth menu with sign-out handling.
- [x] Test then implement anonymous catalog cache, request memoization, uncached stock, nonblocking shop-view tracking, authenticated mutation invalidation.
- [x] Share verified user/shop data within server render requests across dashboard pages; preserve ownership and auth checks.
- [x] Run targeted/full tests, typecheck, lint/build. Fresh reviewer checks cache privacy, invalidation and stale purchasing risks.
- [x] Deploy production, measure same paths/samples, verify cache miss/hit and public content, auth redirects and checkout status; report measured gains and limitations.

## Review focus
- Never store session/account/course entitlement/private paths in shared cache.
- Unpublish/delete/rename must invalidate catalog; errors not cached as missing products.
- Checkout and key availability must remain fresh even when descriptive listing is cached.
- Analytics must record actual visits without blocking rendering or being cached.
- Client account state cannot grant access; server auth stays authoritative.

## Progress
Ruling: continue in existing dirty workspace, as this contains the already deployed work and a worktree at HEAD would omit it. No unrelated changes or automatic commits.


## Completion evidence
- Production deployment `dpl_GbJBXTK4q3KYzCkrwNesRhnWbLiR` promoted to buykub.com on 2026-11-12.
- Full suite 311 tests / 80 files passed; additional ProductEditor key-import-failure regression passed (removed fix -> failed, restored fix -> passed). TypeScript, quiet lint and local/Vercel production builds passed.
- Fresh reviewer found three issues (accidental async effect, course publish invalidation, partial key-import failure invalidation); all fixed and reviewer rechecked with no remaining blockers.
- Production browser verified authenticated dashboard and nonblocking landing profile. Dummy course was unpublished, public page immediately showed missing product without purchase control, then republished and public course restored.
- Anonymous dashboard/classroom requests still redirect to login. Existing paid PromptPay receipt status still returns completed.
- Benchmarks use the same origin, machine and curl method, 5 sequential requests per route, HTML response completion (not browser LCP). Includes first request, no discarded outliers. Files artifacts/performance-before.json and performance-after.json.
- Median total seconds: home 0.360051 -> 0.226909 (37.0% faster); product 1.820744 -> 0.236284 (87.0%); shop 2.012814 -> 0.230053 (88.6%). Home CDN HIT after first request. Catalog HTML remains dynamic (MISS) while anonymous database results use Data Cache.
- First request after a cold catalog cache can remain slower (observed shop 1.446s); this release chiefly improves repeated views. Measurements do not quantify authenticated Dashboard speedup or all geographic networks. Region unchanged.
- Shared catalog is globally invalidated by a verified seller; scope can be narrowed per shop as traffic grows. Changes made outside BUYKUB rely on the 60-second stale-while-revalidate interval; TTL is not a hard maximum under upstream failure. Private authorization and checkout never use catalog cache.
