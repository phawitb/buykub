# Admin and seller payouts Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; independently scoped tasks may be delegated under dispatching-parallel-agents. Preserve the current shared workspace; no commits.

**Goal:** Ship an exclusive admin workspace and verified seller payout operations, with honest provider readiness.
**Architecture:** Verified server admin guard, private administrative tables/RPCs, Stripe reconciliation, immutable payout batch allocations, authenticated Monday job, safe CMS text.
**Tech Stack:** Existing Next.js 16.4.6, React19, Supabase buykub schema, Stripe22, Vitest/Postgres.
**Spec:** docs/superpowers/specs/2026-11-14-admin-payouts-design.md

## Global constraints
- Admin account is exactly phawit.boo@gmail.com verified via Google; no client-only authorization.
- No unsupported Stripe separate transfers, invented provider, test-mode payouts, or real money movement during QA.
- Only live settled eligible funds; 5% commission, seven-day hold, refunds/disputes excluded and no duplicate allocations.
- Automatic transfer remains blocked until real provider connected; Monday10 Bangkok schedule.
- Private identity/payment data never enters public caches or audit payloads.

## Tasks
- [x] 1. Admin foundation: src/lib/admin/{access,service,model}.ts, src/app/api/admin/[action]/route.ts; private admin migration. Tests auth and CSRF, private notes/holds, enforceable shop/product moderation, site validation and audit. Own no payout-engine files.
- [x] 2. Payout ledger: src/lib/payouts/*, migration and SQL tests; eligibility and Stripe reconciliation; atomic reserve/cancel/complete with immutable recipient fingerprint and unique reference; Monday job and provider-readiness state. Tests every excluded funds class and retry/concurrency. Export dashboard DTO and operation interfaces for root integration.
- [x] 3. Admin UI: /dashboard/admin tab workspace; server guard/load and typed props; forms/search/tables/action confirmation, masked details, no fake-success states. Root integrates foundation+payout DTOs before UI work begins.
- [x] 4. Seller settings copy/name consistency and safe landing content integration; navigation admin flag is derived on server.
- [x] 5. Apply reviewed private migrations, reconcile live data read-only, verify tests/build, deploy and smoke check. Record external-provider blockers explicitly; do not claim automatic bank transfers operational without one.

## Review focus
- A confirmed Stripe payment may still be pending settlement or already refunded.
- Concurrency/retries must never allocate the same order or transfer twice.
- Seller edits bank data after approval/preparation; completion must be blocked.
- Google-looking client metadata must never grant admin access.
- Ledger accounting labels must not confuse prepared batches or manual confirmations with provider-verified bank transfers.


## User scope update: manual transfers and slips
The user has no bank API and explicitly deferred automatic transfers. Ship manual payment preparation, recipient details, awaiting/completed tracking and private image/PDF transfer-slip attachments. Uploading a slip does not mark paid; require actual-transfer attestation and reference. No payout cron is scheduled, no automatic transfer or scheduled preparation control is offered.
