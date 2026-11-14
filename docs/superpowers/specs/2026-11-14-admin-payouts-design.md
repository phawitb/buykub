# BUYKUB administration and seller payouts

User authorized design choices and execution without further design approval. Preserve this shared dirty workspace and do not commit unrelated work.

## Outcome
Only the verified Google account phawit.boo@gmail.com can access the admin tab or its server operations. Admin can see platform totals, search users and shops/products, pause seller payouts, moderate shop/product publication, edit a small safe landing-page content configuration, and inspect an audit trail. Seller settings show exactly: ชื่อบัญชีต้องเป็นชื่อเดียวกับข้อมูลที่ให้ไว้ข้างต้นเท่านั้น.

Payouts use saved private seller details, fixed existing 5% commission, and only real successful THB payments reconciled with Stripe. A paid order is not automatically withdrawable: positive amount, live-mode verified charge, settled/available balance transaction, at least the existing seven-day hold, no dispute or pending refund, and net of completed refunds are required. Free, mock, unpaid, cancelled, fully refunded, unverified and already allocated orders cannot be paid. Account-name consistency is checked before preparing payment instructions. Changed payout details invalidate prior recipient approval.

## Payment route constraint and alternatives
1. Keep existing Stripe collection and connect a bank/business disbursement API. Matches saved bank/PromptPay information and existing balances; requires provider onboarding/credentials/funding. Recommended pending user's provider answer.
2. Rebuild future checkout around Stripe Connect direct charges and seller onboarding. Thailand supports direct charges but not separate charges/transfers. This changes seller signup and cannot distribute historic platform charges by itself.

Source: https://support.stripe.com/questions/stripe-thailand-support-for-marketplaces . Do not implement unsupported Stripe transfers or change the platform payout bank to each seller.

Until a real disbursement provider is configured, manual mode supports reconciliation, preparation, export of payment instructions, and recording a real external transfer reference after admin has transferred. Automatic execution must remain visibly unavailable, never mark simulated or merely queued money as paid. Monday scheduler can prepare a reviewable batch; do not call this completed automatic transfer. Actual money movement is not performed during QA.

## UX and access
Admin lives at /dashboard/admin with tabs Overview, Payouts, Users, Shops/products, Website, Activity. All endpoints recheck verified Google identity, confirmed email, same-origin mutations, bounded inputs, and return private/no-store data. Never trust user_metadata email or a client-side role. Use existing service client only after authorization. No public grants to private administrative data; masked bank/identity details in summaries, no national ID/address in logs or browser storage. Protect admin from self-removal; preserve existing purchases and payment history. User management initially covers account overview, private operator notes and payout holds; public moderation must be enforceable beyond hiding UI.

## Payout state and schedule
A unique order allocation prevents duplicate batches. Snapshot immutable recipient/payment instructions when preparing; check current details and eligibility again before completion. Manual completion requires amount/reference/date plus explicit admin confirmation; references unique. Audit who prepared/completed/held/cancelled every batch. Ambiguous external execution remains review_required, never blindly retried. Monday 10:00 Asia/Bangkok (03:00 UTC) scheduler is authenticated and idempotent; default manual. Auto mode requires a connected supported transfer provider, not just a toggle.

## Website configuration
Plain bounded text only: hero title, subtitle, announcement, support email. No executable HTML, arbitrary redirects, credentials or direct legal-document edits. Safe fallbacks maintain landing rendering if config not yet initialized. Publication edits invalidate the public catalog cache.

## Verification
Tests for admin deny/allow, forged metadata, no-store/CSRF, payment/refund/dispute/settlement eligibility, payout name mismatch, concurrent/duplicate allocation, current-recipient changes, unique transfer reference, manual/auto gates, scheduler date/retry, private DB grants and moderation enforcement. Full test/build and authenticated/anonymous production smoke checks before completion.


## User scope update: manual transfers and slips
The user has no bank API and explicitly deferred automatic transfers. Ship manual payment preparation, recipient details, awaiting/completed tracking and private image/PDF transfer-slip attachments. Uploading a slip does not mark paid; require actual-transfer attestation and reference. No payout cron is scheduled, no automatic transfer or scheduled preparation control is offered.
