# Authenticated performance implementation plan

Goal/spec: User requests measured Dashboard and classroom performance fixes and production deploy. Continue existing approved workflow in dirty workspace, no unrelated changes or commits.

Baseline: Browser-controlled full reload to first real content heading visible, 3 rounds, authenticated owner preview for classroom. Tool/locator overhead included, not Navigation Timing/LCP. Products [3020,3320,2971]ms; dashboard [3343,3511,2920]ms; course [2465,2399,2984]ms. Existing deployment dpl_GbJBXTK4q3KYzCkrwNesRhnWbLiR. Measurement framework cannot expose browser Performance API; do not invent TTFB.

Design: Use cryptographically verified Supabase getClaims in proxy (ES256 JWKS confirmed), retaining getUser and DB RLS/entitlement checks in server pages and APIs. Extend request-scoped verified user/shop reuse to remaining seller detail pages. Remove unnecessary my_courses lookup after access+product reads. Defer YouTube iframe until play, no paid-content caching. Inspect DB region before considering co-location.

- [x] Regression tests for invalid/anonymous/non-Google claims, linked Google providers and refreshed cookies; implement proxy optimization.
- [x] Request-scoped auth reuse on remaining seller pages, remove redundant classroom query, deferred video tests.
- [x] Full tests/typecheck/build and independent privacy/access review.
- [x] Deploy, repeat same three-round authenticated browser measurements, verify navigation/video/document/anonymous protection, record results.

Constraints: No private cross-request cache, no removal of authoritative user/entitlement checks, no new purchases. Existing download links and refund/expiry checks preserved. User opted into execution without further design questions.

Ruling: Supabase Settings confirms ap-southeast-1 (Singapore). Move Vercel functions from iad1 to sin1 alongside DB to eliminate trans-Pacific round trips. No database migration or identity configuration changes.

Result: Deployment dpl_CVXVADCpVgDhiWHWwSEwA6FkYvDs promoted to buykub.com, functions verified sin1. Full suite 320 tests / 83 files, build and lint passed; scoped independent review found no blockers. Browser same-method medians: products 3020 -> 949ms (68.6%), dashboard 3343 -> 993ms (70.3%), classroom owner preview 2465 -> 823ms (66.6%). Playback, lesson navigation and private worksheet downloaded successfully; browser event timeout resolved by checking the new local downloaded file. Anonymous Dashboard/classroom redirect 307, document 401; existing test receipt completed/200. No payment transaction or new entitlement was created. Details in artifacts/auth-performance-after.json.
