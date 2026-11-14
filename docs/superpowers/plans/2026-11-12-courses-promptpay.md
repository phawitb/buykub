# Google login, PromptPay and courses implementation plan

**Goal:** Google-only BUYKUB access, paused booking/Calendar features, QR PromptPay by default, and paid courses with a Notion-like lesson layout.

**Authorization:** User approved implementation without design approval, including one-time purchases with a seller-selectable number of access days or lifetime. Continue in the existing dirty workspace because it contains the deployed payment/auth fixes; preserve those changes and unrelated public-schema data. No automatic commits or live charges.

**Architecture:** Extend existing products with delivery_type=course and nullable course_access_days. Lesson content lives in RLS-protected course_lessons, never public product description. Checkout captures verified Google buyer identity and duration; paid orders grant access from paid_at, full refunds and expiry revoke access. Existing Next.js/Supabase/Stripe/Resend stack.

## Interfaces
- products.course_access_days: integer|null (null=lifetime, 1..36500 days).
- course_lessons: id uuid, product_id uuid, title text, position integer, content_html text, youtube_url text|null, documents jsonb (array of {id,name,path} for private uploaded files or {id,name,url} for external HTTPS documents), published boolean.
- Authenticated RPC save_course_lessons(p_product_id uuid,p_lessons jsonb) saves an owner's ordered curriculum transactionally.
- Authenticated RPC course_access(p_product_id uuid) returns JSON {allowed,reason,expires_at}; reason owner/active/expired/refunded/not_purchased.
- Authenticated RPC my_courses() returns rows product_id,name,expires_at,access_status.
- Learner /learn and /learn/[productId]; seller /dashboard/products/[id]/lessons. Course content remains server-authorized on every read/download.
- POST /api/stripe/checkout must use authenticated Supabase when course, binding auth.uid() at the database; guest file/key checkout may remain available. Authenticated Google email comes from getUser(), never request body.

## Tasks
- [x] Google-only login/callback, pause booking entry points and Calendar connection; preserve old rows and unrelated auth providers used by other apps.
- [x] PromptPay checkout opens QR as default, canonical receipts, async webhook/payment error and expiry handling; preserve file/key fulfillment and refunds.
- [x] Course database/RLS, duration snapshot and ownership, safe materials; integration tests cover unpaid, wrong user, expired, full refund and duplicate payment.
- [x] Seller course creation and curriculum editing, YouTube/text/documents; responsive learner table of contents and central content.
- [x] Course email/receipt integration, automated course checkout/access checks; full tests/typecheck/build, independent review, migration/deploy and visual verification.

## Release evidence and remaining verification
Released on 2026-11-12 to https://buykub.com, deployment
`dpl_CH5CPbRU6ayL5d35nGs98ixBVjGT`. Applied both migrations and released the
three matching Edge Functions. Tests: 294/76 files; TypeScript, lint, Vercel
build and four SQL suites against a freshly migrated local database passed.
Production Google login, course editing/publishing, 30-day duration saving and
private document download were verified. Native PromptPay test payment triggered
the deployed webhook, receipt and email; production QR status returned completed.
The screenshot is `artifacts/buykub-course-live.jpg`.

Production classroom verification used seller preview; learner permissions,
duration snapshots, expiry and revocation were exercised in SQL/integration tests.
Stripe rejected the attempted native PromptPay test refund pending account/email
verification, so that test order remains paid. No live payment was performed.
Live buyer purchase and end-to-end PromptPay refund verification remain dependent
on completing Stripe setup; the application remains in test mode.

## Review focus
- Paid lesson contents and document URLs never reach unauthenticated/non-buyers through data APIs.
- Editing duration after purchase never shortens or extends existing grants; expiry uses paid_at and full refund wins.
- Payment identity is backend verified; no client payment success or arbitrary email grants access.
- Repeated/late payment events do not double fulfill/email; QR errors cannot leave indefinite loading.
- YouTube/document URLs and HTML are validated; no arbitrary iframe or unsafe URL execution.
