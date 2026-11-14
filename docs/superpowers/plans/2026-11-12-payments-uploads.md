# Payments and uploads repair plan

> Use superpowers:executing-plans inline, followed by one independent review.

**Goal:** Working local seller uploads and Stripe test Checkout through verified payment to private file delivery.
**Architecture:** Preserve existing Next.js + Supabase buykub schema + Stripe Checkout. Create missing Storage buckets with owner-only writes/private files. Deploy signed Stripe webhook and paid-order download Edge Functions. Keep privileged credentials inside Supabase. Next routes proxy download requests; success UI shows verified state and download link.
**Spec:** User requested payment and upload testing/fixes. Existing authorization permits configuration in buykub-th; preserve legacy tables and unrelated work. No live charges.

## Constraints and review focus
- Existing public schema remains inaccessible; no existing data deletion.
- Never fulfill unpaid sessions, unverified events, or expired/cancelled contexts.
- Duplicate events must not create duplicate orders; database failures must allow Stripe retry.
- Downloads require completed paid orders and owner-prefixed file paths; signed links expire.
- No permanent public product file URLs, secrets in frontend, or false payment success messages.

## Tasks
- [x] Storage: inspect inventory, add narrow bucket/policy SQL, test owner uploads and anonymous denial. Match file limit to project configuration.
- [x] Webhook: failing tests for signatures/unpaid/failed RPC; implement, configure test webhook and deploy to current project. Snapshot checkout amount for accurate order totals.
- [x] Delivery: failing tests for unpaid/cancelled/missing/mismatched files and UI states; implement private signed download and neutral pending UI.
- [x] E2E: create clearly labelled test shop/product, upload controlled fixture, complete Stripe test card checkout, verify webhook order and download content. Test duplicate event/unpaid rejection.
- [x] Full tests/typecheck/lint, independent review, record concrete results and any external prerequisites.

## Decisions
- Work in current checkout so localhost uses fixes; preserve all pre-existing changes. No git commit/push requested.
- Existing Stripe endpoint points at old inaccessible project. Configure current project webhook and retain old endpoint until successful cutover.
- Email/Calendar are secondary deliveries; do not send messages without explicit authorization. Download fulfillment is tested in-browser.

## Verification evidence (2026-11-12)
- Uploaded the 118-byte dummy file and PNG through the seller UI; saved published product in `/buykub-test-phawit`. Anonymous permanent file URL denied.
- Unpaid checkout download returned 403. Stripe sandbox card Checkout completed for THB 50; Stripe API confirms `livemode=false`, `payment_status=paid`, amount 5000 THB minor units.
- Seller orders page shows exactly one paid test order (6d5977ac-0fb7-4d0d-838d-e54baa1f30a9). New webhook fulfilled it; obsolete project test webhook is disabled.
- Success-page download saved `buykub-test-download.txt`; downloaded bytes match uploaded fixture exactly. Signed links expire after 300 seconds.
- SQL rollback regression verified price snapshot despite a subsequent price change and one order on duplicate finalization.
- Independent review found encoded/backslash path traversal. Three new regression cases failed before the fix and passed after canonical path validation; deployed the fixed download function.
- Automated checks: 197 tests / 62 files pass, TypeScript and scoped ESLint pass, git diff whitespace check passes.

## Remaining production setup
- Current keys and payment were TEST mode. Live collection and production site URLs remain unconfigured.
- Refund events do not yet synchronize order status automatically. Existing refunded database orders cannot download. Email/Calendar delivery is outside this file-purchase test and remains unverified.
- An accidentally named duplicate Edge Function `smooth-workerdownload-product` was replaced with a deny-all 410 handler; it is unused and retains JWT verification.
