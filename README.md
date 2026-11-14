# BUYKUB

A Thai digital storefront for downloadable files, product keys and paid courses,
built with Next.js, Supabase, Stripe and Resend.

## Local development

Use the installed Next.js guides under `node_modules/next/dist/docs/` when
changing application code; this project uses a version with changed APIs.

```bash
npm ci
npm run dev
```

Configure `.env.local` as described below, then open
[http://localhost:3000](http://localhost:3000). Verification commands are
`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Supabase connection

Local development uses the `buykub-th` project and the isolated `buykub` schema.
Set these values in `.env.local` (never commit private keys):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://bdhoqdhcybwhsdzwkwmq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<project publishable key>
NEXT_PUBLIC_SUPABASE_DB_SCHEMA=buykub
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Enable Google in Authentication and allow `http://localhost:3000/auth/callback**`.
Expose only `buykub` through Data API; existing `public` tables belong to a separate
application. RLS limits private records to their owner.

`supabase/bootstrap-buykub.sql` creates a **new** schema in one transaction and
aborts if the schema already exists. It was applied to this project; do not rerun
it. Use explicit follow-up migrations for subsequent changes. The script is built
by `python3 scripts/build-buykub-schema.py` and intentionally excludes shared
Storage configuration.

## File purchases and Stripe test setup

Apply follow-up migrations `20261112090000_buykub_storage.sql` and
`20261112091000_checkout_amount.sql` after the bootstrap (already applied to
buykub-th). Files use the private `product-files` bucket, limited to 50 MiB by
the current Supabase plan. Public product images are limited to 5 MiB. Storage
writes require the authenticated owner's folder prefix.

Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to matching
Stripe test keys locally. Deploy `stripe-webhook` and `download-product` using
`supabase/config.toml`. Both default to schema `buykub`; override with
`BUYKUB_DB_SCHEMA` if needed. Supabase supplies their service-role credentials;
never expose those credentials in the frontend.

Configure the Stripe webhook at
`https://bdhoqdhcybwhsdzwkwmq.supabase.co/functions/v1/stripe-webhook` for
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`.
Set its signing secret as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function
Secrets. The handler verifies signatures and payment state before fulfillment.
Checkout prices are snapshotted; duplicate events do not duplicate orders.

After confirmed payment, the success page offers a private download link that
expires after five minutes. The checkout session URL grants access to the
purchased download and should be treated as a receipt link, not shared publicly.

The dummy shop `/buykub-test-phawit` was tested with an uploaded file and image,
a THB 50 Stripe sandbox card payment, and byte-for-byte matching file download.
This environment still uses **test payments**, not live collection. Live keys,
production payment keys and production payment verification require separate
configuration before live collection. Booking and Calendar features are paused.

## Customer email and refund synchronization

Apply `20261112092000_delivery_refunds.sql` after the amount migration, then
deploy `send-product-key` and the updated `stripe-webhook`. See
[`supabase/functions/send-product-key/README.md`](supabase/functions/send-product-key/README.md)
for the required Resend credentials, additional Stripe refund events, and retry
limits. File emails contain a receipt link that checks access again when the
buyer downloads. Seller retries require an authenticated owner; order recipient
and payment fields can only be written by the backend.

Successful full refunds initiated in Stripe automatically mark the order
refunded and block new downloads. Partial, pending, and failed refunds do not
revoke access. Previously issued signed URLs may remain usable for up to five
minutes, and an already open receipt page updates its message on refresh.

The deployed email handler uses the verified `notify.buykub.com` Resend domain
and sends as `BUYKUB <orders@notify.buykub.com>`. A sending-only API key scoped
to this domain is stored in Supabase secrets. A Stripe test checkout on
2026-11-12 delivered its receipt to the authorized test recipient and the linked
file downloaded successfully. Stripe is still in test mode. No historical file
orders are automatically emailed.

`www.buykub.com` forwards to `https://buykub.com` through Porkbun with the path
preserved. The canonical domain stays on Vercel; unrelated DNS and email records
are preserved. Supabase allows both localhost and the canonical auth callback.

The `isomorphic-dompurify` override pins its runtime `jsdom` to `25.0.1`, following
the upstream CommonJS/Vercel workaround. The separate test-environment jsdom is
unchanged. A subprocess regression checks that the production loading mode still
sanitizes script tags and JavaScript links.


## Google sign-in, PromptPay and courses

Released to **https://buykub.com** on 2026-11-12 (Vercel deployment
`dpl_CH5CPbRU6ayL5d35nGs98ixBVjGT`). Both migrations below were applied to
`buykub-th`, and `stripe-webhook`, `send-product-key`, and `download-product`
were updated. The production server credentials and cleanup secret are configured;
Stripe remains in **test mode**, with PaymentIntent and refund webhook events enabled.

Release verification:
- 294 tests across 76 files, TypeScript, lint and the production build passed.
  A fresh local database passed the ordered migrations and four SQL suites,
  including real database-role checks for unpaid, wrong-account, expired and
  fully refunded course access.
- Google sign-in returned to the classroom on the production domain. A dummy
  two-lesson course was created, published and edited through the UI, including
  YouTube, text, a private document and a 30-day access setting. Lifetime access
  is also supported. Production document downloads matched the uploaded bytes.
- A native PromptPay **test** payment completed through Stripe's test simulator;
  the webhook fulfilled the order, the receipt changed automatically, and the
  email to the authorized test recipient was marked sent. The production QR
  status endpoint and receipt both confirmed completion.
- Live buyer course purchase has not been exercised: learner entitlement and
  revocation were verified by SQL/integration tests; the production classroom
  walkthrough used the seller's preview access.

**Remaining provider limitation:** Stripe rejected the native PromptPay test
refund because collecting refund details by email requires account/email
verification. No refund was created for that test payment. Refund application
logic passed automated checks and the earlier card test refund was verified,
but end-to-end PromptPay refunds and live payments still need verification after
Stripe account setup. Do not treat this test-mode release as live payment approval.

### Authentication and paused bookings

Sign-in and protected seller/learner pages use Google authentication. Enable
Google in the Supabase project and register the application's `/auth/callback`
URL for localhost and each production origin. Standard sign-in requests no
Calendar permissions. Keep other applications' auth providers and existing
`public` data intact: Google-only access is enforced in BUYKUB, rather than by
removing shared project providers. Every new checkout verifies the Google user
through `getUser()` and requires a confirmed account email. The reservation RPC
also enforces this identity before reserving stock. All new file, key and course
orders bind to that account, including free products. Legacy guest receipts and
fulfillment remain usable; new guest checkout is disabled.

Booking navigation, public service cards and Calendar connection controls are
hidden. `/dashboard/bookings` and its child routes redirect to products; new
service checkout is rejected. Existing booking rows and historical receipts are
preserved. Historical Meet links can remain on old receipts, but the UI no longer
promises new Calendar synchronization.

### Environment and payment configuration

Keep the existing public Supabase values, `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=buykub`
and `NEXT_PUBLIC_SITE_URL`. The Next.js server also needs:

```dotenv
STRIPE_SECRET_KEY=<Stripe test secret key while testing>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role key; server only>
CRON_SECRET=<secret used by the scheduled checkout cleanup endpoint>
```

Never prefix service-role, Stripe secret or cron credentials with `NEXT_PUBLIC_`.
The QR flow uses server-created Stripe PaymentIntents; it does not require a
browser Stripe publishable key. Ensure PromptPay is available in the intended
Stripe account and test environment before enabling real collection. Paid
products open a THB PromptPay QR checkout by default. Zero-price products use
Stripe's `no_payment_required` fulfillment path without requiring QR payment.

The `stripe-webhook` Edge Function needs `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`, in addition to Supabase-provided credentials. Subscribe
the endpoint to `payment_intent.succeeded`, `payment_intent.payment_failed`, and
`payment_intent.canceled`, while retaining the existing Checkout Session and
refund event subscriptions listed above. Payment success comes from verified
provider events, never the browser redirect. Receipts support both `cs_` Checkout
Session references and opaque `pp_` PromptPay references.

`vercel.json` schedules `/api/stripe/cleanup` daily; the endpoint requires the
`CRON_SECRET` bearer credential. New checkout traffic also performs bounded
cleanup. Expiry cleanup checks Stripe before releasing reserved keys, preserving
payments that are processing or already succeeded.

Course emails use the existing `send-product-key` function and Resend settings
(`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO_EMAIL`). They
link to the classroom and require the buyer's original Google account there.

### Migration and release order

Apply follow-up migrations to the isolated `buykub` schema in timestamp order,
after `20261112092000_delivery_refunds.sql`:

1. `20261112100000_promptpay.sql` adds PromptPay reservation, intent and receipt
   handling while retaining existing file/key fulfillment.
2. `20261112101000_courses.sql` adds course lessons, private material access,
   duration snapshots, learner identity and entitlement checks.
3. `20261112102000_google_checkout.sql` requires confirmed Google identity for
   every reservation and binds new orders to the initiating account. It preserves
   existing guest contexts and course expiry behavior.

Do not rerun `bootstrap-buykub.sql`, reset the database, or apply unrelated legacy
`public` migrations. After verifying these migrations, release the matching
Next.js app, `stripe-webhook`, `send-product-key`, and the updated
`download-product` function together, using their existing authorization settings
in `supabase/config.toml`. Course purchases are rejected by the file download
handler. Verify Google callbacks, QR completion/failure/expiry, file/key
regressions, course expiry and full refunds in Stripe test mode before live use.

### Course authoring and access

Choose **คอร์สเรียน** when creating a product. Courses start as drafts and open
`/dashboard/products/[id]/lessons`, where sellers add, reorder and publish lessons
with rich text, YouTube videos and up to 20 documents per lesson. A course must
have at least one published lesson before its product listing can be published.
Private uploads use the existing 50 MiB `product-files` limit. External HTTPS
links retain the access rules of their destination website; YouTube videos retain
YouTube's own visibility settings.

Buyers pay once for lifetime access or a seller-selected 1–36500 whole days.
The checkout snapshots that duration; access starts at confirmed `paid_at`.
Later product duration edits affect new orders only. `/learn` lists purchased
courses, and `/learn/[productId]` rechecks access before reading any lessons.
Unpaid, wrong-account, expired and fully refunded purchases cannot read course
materials or obtain new document links. Partial refunds do not revoke access.
Unpublishing the sales listing does not remove an existing buyer's valid access;
unpublished lessons remain hidden from buyers.

Lesson HTML is sanitized again on the server. Video embeds are restricted to
canonical YouTube URLs, and classroom data contains document names/IDs rather
than private storage paths. `/api/courses/[productId]/documents/[documentId]`
checks identity and entitlement before issuing a short-lived private download
or redirecting to an external document. A previously issued signed URL can remain
valid briefly, and files already downloaded cannot be recalled.


## Performance release — 2026-11-12

Production deployment `dpl_GbJBXTK4q3KYzCkrwNesRhnWbLiR` is live at
https://buykub.com. Landing HTML is static/CDN cached, with the account menu
loaded independently in the browser. Protected routes remain server-authorized.
Anonymous published catalog data is cached for 60 seconds; a same-origin,
Google-authenticated seller endpoint expires the public catalog tag after writes,
including course publication and edits followed by failed key imports. Public
catalog cache never includes paid lessons, private file paths, or account data.
Stock and checkout validation stay live. Seller layout/pages share verified user
and shop reads through request-scoped React cache. Shop-view recording no longer
blocks rendering.

Five-request median HTML completion times from the same machine and origin:
home 0.360s -> 0.227s; product 1.821s -> 0.236s; shop 2.013s -> 0.230s.
See `artifacts/performance-before.json`, `artifacts/performance-after.json` and
`docs/superpowers/plans/2026-11-12-performance.md` for evidence and limits.
These measure response completion, not browser rendering or global user latency.
Cold cache fills still query Supabase; catalog changes outside BUYKUB refresh
through the timed stale-while-revalidate path. A failed refresh can retain older
public display data, while checkout and course authorization recheck current data.
Production unpublish/republish invalidation, authenticated account display and
anonymous protected-route redirects were verified after promotion.


## Authenticated performance release — 2026-11-12

Superseding deployment `dpl_CVXVADCpVgDhiWHWwSEwA6FkYvDs` is live at
https://buykub.com. Functions now run in `sin1` alongside the Supabase database
(`ap-southeast-1`), instead of crossing from `iad1`. Proxy uses verified signed
claims; server pages/APIs still check current users, ownership and entitlements.
Seller detail pages reuse request-scoped user/shop reads. Classroom drops the
redundant library RPC and loads YouTube only after the learner opens the video.
No private content or entitlements are cached across requests.

Three authenticated reloads per page, median time until real content heading
visible: Dashboard 3.343s -> 0.993s; products 3.020s -> 0.949s; classroom
2.465s -> 0.823s. These include browser automation overhead and are not LCP/TTFB;
classroom used owner preview, not a paid learner account. See
`artifacts/auth-performance-before.json` and `artifacts/auth-performance-after.json`.

320 tests across 83 files, production build and lint passed. Production video
playback, lesson navigation, private worksheet download, guest route protection
and existing test receipt were checked. The browser download event timed out,
but the newly downloaded worksheet was confirmed on disk with expected content.


## Workspace redesign — 2026-11-12

Earlier workspace deployment: `dpl_29g7njjeQv8ma5WFx3ujiE5614Y9` (superseded by the full-width storefront release below).
Four workspace destinations: My Shop (`/dashboard/products`), Purchases (`/learn`),
Analytics, Settings. Signed-in homepage and `/dashboard` route to My Shop; old
orders list redirects to Analytics with its existing order-detail URLs preserved.
My Shop shares the storefront presentation with management controls, separate
appearance saving, customer preview, draft visibility, and new-shop creation.
Settings writes only payout fields. Analytics combines paid-only revenue,
traffic, estimates and incoming orders using one paged order dataset. Platform
fee estimate is 5% to match published terms; it is not a settlement balance.

Purchases verifies current Google identity server-side and scopes reads to buyer
ID or unlinked non-course orders with the exact normalized confirmed account
email. It exposes only display fields and gated receipt/classroom links. Existing
course entitlement and refund checks remain. Signed-in new file/key checkout
uses the Google account email; historical guest purchases need that same email.
No database migration was required.

Verification: 383 tests/90 files, lint, local webpack build and Vercel production
Turbopack build/TypeScript passed. Authenticated local/live navigation, preview,
real reversible shop bio save, Analytics/refund filter and guest access checked.
The live buyer library was empty for the current seller account; nonempty
file/key/course and denied/refunded/expired cases were covered by automated
tests without creating a new payment. Screenshot: `artifacts/buykub-workspace-live.jpg`.


## Full-width storefront and Google checkout — 2026-11-12

Deployment `dpl_7ewwkU1Brn8pj4m5U2H9c1VrsJ4m` is promoted to https://buykub.com,
with functions in `sin1`. Public shops and My Shop fill available width. Appearance
editing and product add/edit use accessible floating dialogs; direct editor URLs
still work. Product drafts survive Back/Forward within the products workspace in
memory, scoped to user/shop/product, while retained upload references are protected.

Buyers without a shop see Purchases and an explicit Open shop action. Merchant
landing routes redirect them to Purchases. Creation CTAs use `?create=1` (chosen
slug links also preserve creation intent). Every new purchase requires verified
Google identity and confirmed account email; the database migration also enforces
this before stock reservation and binds all new orders to that account.

Verification: 430 tests/94 files, five PostgreSQL suites, lint, local webpack build
and Vercel production build passed. Local authenticated browser verified dialogs,
preview, unchanged dummy product save, responsive layouts and Back/Forward draft
restoration. An authenticated file checkout generated Stripe Test Mode QR without
manual email input; no payment was made. Live storefront renders the new design;
anonymous checkout returns 401 and private workspace routes redirect to login.
Post-deployment clicks and saving a screenshot artifact are pending Mac unlock;
no screenshot file is claimed for this release. Evidence: `artifacts/storefront-fullwidth-release.json`.

## Storefront polish — 2026-11-12

Deployment `dpl_EWqfZqiweAPvKeB4apjQ1FzB694M` is promoted to https://buykub.com.
My Shop has a slim single-row toolbar without a visible page title. Ten locally
hosted nature covers provide stable per-shop defaults, with an explicit shuffle
control in the editor; uploaded covers take precedence. Source and license
records are in `docs/licenses/shop-covers.md` and the public cover credits JSON.
File, key and course products without images have distinct subtle SVG artwork.
Guest Buy opens an accessible Google dialog instead of inline explanatory copy.
Existing Google OAuth and server-side checkout authorization remain unchanged.

Verification: full suite 450 tests/97 files, then 24 targeted tests after the
final upload-preview fix; lint and final Vercel build passed. Browser checks
covered guest file/course dialogs, close/Escape focus restoration, shop mode
toggle, shuffled cover preview and a 390px toolbar without horizontal overflow.
Live authenticated mode switching and cover loading passed; anonymous checkout
returns 401. No payment or database change was made. Screenshot attachments
were waived. Evidence: `artifacts/storefront-polish-release.json`.

## Direct shop editing — 2026-11-12

Deployment `dpl_DVbBwbemqKS3AmTA2Yhhe2g3inGg` is promoted to https://buykub.com.
Profile, cover, title and bio are directly clickable in management mode, each
opening its own focused dialog. Saving a section preserves unrelated pending
drafts. Accent controls were removed and Add product is a prominent labeled CTA.
New products choose Course or File once; saved categories and customer badges
derive from delivery type. Legacy key inventory and fulfillment remain supported.

Verification: 467 tests/98 files, then 27 targeted tests after the final
draft-retention fix; lint, local build and final Vercel build passed. Browser
checks covered all four dialogs, unchanged bio save, Add product and 390px layout.
Live profile editing and new controls verified after promotion. No database
migration or new payment. Evidence: `artifacts/inline-shop-editing-release.json`.

## Catalog reset, sharing and live Stripe — 2026-11-13

Current production: `dpl_3tap9yd4DK2sEHW55GY8ev31Mfi9`, promoted to
https://buykub.com, with server functions in Singapore (`sin1`). This supersedes
the historical test-mode status above. Production Vercel and Supabase use the
restricted live key `BUYKUB live checkout`; no secret values are stored here.
The live webhook `we_1UbAtxH7ZH1HRlx6SJPzdXpK` sends 11 checkout, PaymentIntent
and refund events to the existing `stripe-webhook` Edge Function. The previous
sandbox endpoint is disabled. Local `.env.local` remains sandbox-only.

All original BUYKUB products and orders across both shops were removed after
verifying their Stripe payments were test-mode transactions and canceling open
test checkouts. Both user profiles and shops, the unrelated `public` schema,
Stripe history and original storage objects were retained. The private backup
is `.private-backups/2026-11-13-before-reset/buykub-data.json` (0600), excluded
from Git/deployment. It contains customer data and must not be published.

The dummy shop now contains a free study sheet, a 20 THB downloadable sheet
created/uploaded through the seller UI, and a 50 THB course with two lessons and
a private document. One new 0 THB live order is retained as verification data.
The unpaid 20 THB live PromptPay probe was canceled in Stripe; its cancellation
webhook changed the website context to canceled and the QR API to expired.

Shop manager, public shop and product detail pages have canonical share URLs.
The public shop displays its URL. Native sharing, clipboard and manual-link
fallback behavior have automated coverage. During live testing, a free-checkout
bug was reproduced against Stripe: `payment_method_collection` is subscription
only. Removing it fixes one-time no-cost orders; regression checks cover file,
key and course purchases. The webhook now rejects mismatched live/test events
before side effects. Migration `20261113093000_product_key_update_ownership.sql`
also prevents moving an unassigned key into another seller's product; the local
SQL regression passed and the production policy was inspected after applying.

Verification: 490 tests / 99 files pass after the final fix; lint, local webpack
build, Vercel build and production preflight pass. Live browser checks covered
product creation/upload, shop bio save, course owner preview/lesson switching,
purchase library, Analytics and the new share controls/visible shop URL.
A 0 THB live checkout completed through Stripe, delivered email once, and
downloaded a byte-identical file. Live PromptPay returned `testMode: false` and
rendered a loaded 480px QR. Anonymous checkout/document requests return 401;
guest course access redirects to login and anonymous lesson reads are denied.
No nonzero live payment or live refund was executed. Paid settlement and live
refund end-to-end verification remain untested; automated refund and entitlement
tests passed. Screenshot attachments were waived by the user.
# Public branding and private payout details — 2026-11-14

Production deployment `dpl_J9VSqVx2U7cFKJmuj2LaHd3XQWTn` is promoted to
https://buykub.com (Singapore region).

- Verified Google sessions skip `/login`; auth destinations cannot redirect in a loop.
  Brand links lead to the landing page for signed-in users too.
- Original B favicon replaces the legacy icon; muted text is darker.
- Removed stale production test-mode claims. Genuine sandbox payment warnings remain conditional.
- Renamed the demo shop to `BUYKUB`, `/buykub-store`; invalidated public catalog cache.
- Applied `20261114100000_private_seller_payout_profiles.sql`: private owner-only payout
  identity/address table, validated new writes, exact migration of legacy payment details,
  cleared public shop payment fields and blocked new writes there. Legacy incomplete
  profiles must be completed at the next save. Browser drafts from both old prefixes are cleared.
- Support is `support@buykub.com`; actual receipt sender is `orders@notify.buykub.com`.
  Stripe public support/site/policy links now use BUYKUB; phone display on receipts is disabled.
  Stripe legal representative records and linked payout account were not changed.
  Seller payouts still require staff operation; no automatic seller transfers were added.

Validation: 539 tests / 104 suites passed after review; build passed; lint had no errors
(two existing unused-variable warnings). Local database tests verified ownership,
anonymous denial, invalid identity/address rejection, and atomic saves. Production SQL
confirmed forced RLS and all three owner policies; anonymous access is denied and copied
payment details match the private backup. Live browser checks covered login skip, landing
logo, settings, Analytics, purchases and course reader. Nine public pages passed the
personal-name/stale-test-copy scan after cache invalidation. No real identity details were
invented or saved for testing.


## Admin workspace and manual seller payouts — 2026-11-14

Production deployment `dpl_CG834DXhzonNjCuV2oqxjGQG4Tkf` is aliased to
https://buykub.com (Singapore region). This supersedes
`dpl_J9VSqVx2U7cFKJmuj2LaHd3XQWTn`.

- `/dashboard/admin` is reachable only by `phawit.boo@gmail.com` when the Supabase
  `getUser()` identity is Google and the address is confirmed. The navigation flag is
  derived on the server; client metadata grants nothing. `/api/admin/[action]` and
  `/api/admin/payout-slip` check same-origin before anything else.
- Private admin tables carry user holds/notes, shop and product moderation, site text and
  an append-only audit log. Database triggers block publishing and new checkout contexts
  for moderated shops and products, so a moderation hold cannot be bypassed by direct writes.
- Payout eligibility counts only live, settled, non-refunded, non-disputed funds after the
  seven-day hold, less the published 5% commission, reconciled against Stripe. Partial
  unique indexes on order, charge and payment intent make a second allocation of the same
  money impossible, and a batch records an immutable recipient fingerprint, so a seller who
  edits bank details after preparation blocks completion instead of silently repointing it.
- Manual operation only: prepare, cancel, and complete-with-attestation plus a reference.
  Transfer slips (PNG/JPEG/WebP/PDF, max 4 MB, magic-byte checked) go to the private
  `seller-payout-slips` bucket and are read through 60-second signed URLs. **Uploading a
  slip does not mark a payout paid.** No bank API is connected, no automatic transfer
  exists, and `vercel.json` schedules no payout cron — `/api/payouts/cron` requires the
  `CRON_SECRET` bearer credential and is not invoked on a schedule.

Applied migrations, in order after `20261114100000_private_seller_payout_profiles.sql`:
`20261114110000_admin_workspace.sql`, `20261114110500_payout_account_name.sql`,
`20261114111000_seller_payout_ledger.sql`. All four were already present in `buykub-th`
and were confirmed by reading the new tables with service-role credentials before release.
No new environment variable is required and no Edge Function changed.

Verification: 613 of 614 tests across 119 files pass, TypeScript, lint (0 errors, 2
existing unused-variable warnings) and the production build pass.
`src/lib/brand-source.test.ts` errored only because `ripgrep` is absent on the release
machine; the same search run with `grep` found no legacy brand string in `src`.
Post-deployment checks: landing, demo shop, terms, privacy, icon and login return 200;
`/dashboard/admin` and `/dashboard/products` redirect anonymous visitors to `/login` with
their `next` target; `POST /api/admin/hold` and `POST /api/admin/payout-slip` return 403 on
a cross-origin request; `/api/payouts/cron` returns 401 without the cron credential.

**Not verified:** the signed-in admin workspace was not walked through in a browser during
this release, and no payout batch was prepared, completed or slipped against live data.
No real money moved and no live payment or refund was executed. Automatic bank transfers
are not operational; seller payouts remain a staff-operated manual process.

## Visual refinement across every surface — 2026-11-14

Production deployment `dpl_BUmNAppHoCgftfq8sCqAEYDmcBYC` is aliased to https://buykub.com
(Singapore region), superseding `dpl_CG834DXhzonNjCuV2oqxjGQG4Tkf`. This is a refinement of
the incumbent world, not a rebrand: the indigo accent `#5046e5`, the light paper ground, the
`BUYKUB` wordmark and the `B` mark are unchanged. The design system is recorded in
[`DESIGN.md`](DESIGN.md) and durable product truth in [`PRODUCT.md`](PRODUCT.md).

**Untrue copy removed from the landing page.** The catalog was reset on 2026-11-13 and no
paid live order has settled, so none of the following could be sourced:
- Hero statistics `50+ ร้านที่เปิดใช้งานแล้ว`, `฿330K+ ยอดขายรวมผ่านระบบ` and
  `ทุกวันจันทร์ รอบจ่ายเงิน ไม่เคยพลาด`.
- An invented testimonial attributed to `Studio เพ้นท์`.
- Six named shops in the audience band and five more in a "featured shops" section, each
  linking to a slug that renders "ไม่พบร้านนี้" — `/baansuan`, `/coachnok`, `/paintstudio`,
  `/tutornan`, `/mukdee`, `/ladda-design`. All were removed; one real link to the live
  example shop `/buykub-store` replaces them.
- `โอนเงินทุกวันจันทร์` in five places on the landing page and once in the seller's own
  Settings. Payouts are prepared and transferred by hand after a seven-day hold, with a slip
  attached; no cron is scheduled and no bank API is connected. Every surface now says so.

`src/components/__tests__/LandingCopy.test.tsx` fails the build if a shop count, a revenue
total, a testimonial or a weekly payout promise returns.

**Craft work.** A four-step elevation scale (`--lift-1`…`4`, offset plus blur) replaces every
ad-hoc `shadow-sm/md/lg/xl/2xl` across 21 files. Motion tokens, one authored page entrance
(`data-enter`, inside `prefers-reduced-motion: no-preference`, content visible by default),
hover/press states on every control. Browser surfaces are themed from the palette: selection,
caret, scrollbar, focus ring, underline offset, and tabular numerals for money and counts.
`src/components/icons.tsx` is now the only icon source — 30 drawn 24×24/1.75-stroke marks
replacing `✓ → ← ↑ ↓ ▤ ▷ ✦ ＋ ↗` everywhere; arrows inside running prose stay as text.
Ten eyebrow labels above headings were deleted, the hero metric row and the four-same-size-card
feature grid were restructured, and decorative `01/02/03` numbering was dropped where the
sequence carried no information.

**Thai line breaking.** `text-wrap: balance` breaks inside Thai words — `ครีเอเตอร์` split as
`ครี` / `เอเตอร์` on the live page. `text-wrap: pretty` keeps the browser's Thai segmentation
and still avoids orphans, verified in Chrome at 1440; it is now the default for headings and
body alike, and `balance` is banned in `DESIGN.md`. Uppercase and wide letter-spacing were
removed from Thai strings, where they do nothing but loosen the glyphs.

Verification: 614 tests / 118 files, TypeScript, lint (0 errors, 2 pre-existing unused-variable
warnings) and the production build all pass. `src/lib/brand-source.test.ts` now scans with Node
instead of spawning `rg`, which used to fail the suite on machines without ripgrep — this is the
first release in which the whole suite passes. Browser checks at 390, 768, 1024 and 1440 found
no horizontal overflow and no console errors on the landing page, the example shop, a product
page, login, My Shop, Analytics, Settings and the purchase library. Production was re-scanned
after promotion: zero stray glyphs, zero eyebrow labels, and none of the removed claims present.

**Not verified:** no checkout, payment, refund, product save, payout batch or admin write was
exercised — this release changed presentation only, and every such flow remains covered by
automated tests alone. The admin workspace at `/dashboard/admin` was not opened.

## Fastwork-derived theme — 2026-11-14

Production deployment `dpl_5So3DUueC2G9jMhLDYoCF6VUb6Wk` is aliased to
https://buykub.com (Singapore region), superseding `dpl_BUmNAppHoCgftfq8sCqAEYDmcBYC`.
This replaces the indigo-on-white world set earlier the same day; the full system is
recorded in [`DESIGN.md`](DESIGN.md).

The tokens were read from **fastwork.com's own computed styles**, not copied from a
screenshot: colour roles, the radius scale, the type scale and weights, control heights,
the layered shadow steps, and the grey-body/white-card relationship. Their wordmark, logo,
imagery, icons and copy were not used, and "Google Sans" is Google-proprietary so it is not
used either.

| | Fastwork | Shipped |
|---|---|---|
| Brand | `#0074e2` | `--accent: #0074e2` |
| Body / card / well | `#f5f5f5` / `#fff` / `#f1f1f1` | identical |
| Secondary text | `#737373` | **`#6e6e6e`** — see below |
| Border | `#ebebeb` / `#d4d4d4` | identical |
| Radius | pill `9999px`, 16 / 12 / 6 / 42 | identical |
| Headings | weight 500, −0.025em | identical |
| Type scale | 1.19 ratio, 11→48px | identical |
| Control heights | 28 / 36 / 40 / 48 / 56 | identical |
| Font | Google Sans | **Noto Sans Thai** (Google's own, Thai coverage) |
| Dark mode | full | **not built** — roles are named for it, no dark values ship |

**Two of their values were not copied, because they fail WCAG AA.** Their `#737373`
secondary text is 4.35:1 on their own `#f5f5f5` ground; `#6e6e6e` is the nearest neutral
that reaches 4.51:1 on the tightest ground here. Their `#0074e2` as *text* is 4.19:1 on
grey, so the accent is split: `--accent` `#0074e2` for fills (white on it is 4.57:1) and
`--accent-text` `#006cd2` for text (4.56:1). `src/app/brand-assets.test.ts` now holds
`muted`, `ink` and `accent-text` to 4.5:1 on all three light grounds and fails the build
otherwise.

Structural changes: the header is a dark pill floating clear of the page edge; `WhyUs` is
the single dark band per page, carrying the 42px page radius; product cards became white
cards with the thumbnail inside them, after their service cards; every control is a pill;
input state is an inset ring rather than a size change. The `B` mark and favicon were
recoloured to `#0074e2` and the multi-size ICO rebuilt from `icon.svg`; the wordmark
dropped its gradient for two solid tones. Placeholder artwork moved to Fastwork's own
pastel accents (`#b3f4ef`, `#d3bdff`, `#b3efbd`), and the storefront shells left their
cream `#faf9f7` ground for the system grey.

Verification: 614 tests / 118 files, TypeScript, lint (0 errors, 2 pre-existing
unused-variable warnings) and the production build pass. Production was re-read after
promotion and reports `Noto Sans Thai`, body `rgb(245,245,245)`, `--accent #0074e2`,
`--accent-text #006cd2`, `--muted #6e6e6e`, `--radius-page 42px`, `h1` weight 500, a pill
CTA filled `rgb(0,116,226)`, and a dark band at `rgb(19,25,34)` with a 42px radius. No
horizontal overflow at 390 or 1440 and no console errors on the landing page, the example
shop, a product page, settings and My Shop. Routes and guards are unchanged: protected
routes still redirect anonymous visitors and `POST /api/admin/hold` still returns 403.

**Not verified:** this release changed presentation only; no checkout, payment, refund,
product save, payout or admin write was exercised. The lesson editor, order detail and the
admin workspace were not opened in a browser — they inherit the system through the shared
tokens and component classes and pass their automated tests, but were not looked at.

## Landing page rebuild — 2026-11-14

Production deployment `dpl_7oV2fL7BypFDuF9ZRcimyb1uQBAG` is aliased to
https://buykub.com, superseding `dpl_5So3DUueC2G9jMhLDYoCF6VUb6Wk`. The app keeps the
Fastwork-derived system recorded in [`DESIGN.md`](DESIGN.md); only `/` changed shape,
following a mock-up the user supplied, in the system's own blue rather than its orange.

Sections: sticky white header (wordmark, three anchors that all resolve, `ร้านของฉัน`
before the profile icon), a split hero with the photograph bleeding off the right edge,
a four-up grid of what a seller can list, a dark band with the three steps, a gradient
payment-link band, a scrolling review row, pricing, FAQ, closing CTA and footer. The
earlier Tesla-style full-viewport panel stack and its scroll snapping were removed.

**Reviews are labelled placeholders.** `Testimonials.tsx` holds twenty invented sellers —
ten in Thai script, ten romanised, ratings mixed 4 and 5 — running as one continuously
scrolling row. BUYKUB has no customers to quote: the catalog was reset on 2026-11-13 and
no paid live order has settled. The section says so on the page
("ข้อความตัวอย่างสำหรับจัดหน้า · ยังไม่ใช่รีวิวจากผู้ขายจริง") and
`src/components/__tests__/LandingCopy.test.tsx` fails if that label is dropped while the
placeholder data is still in place. Supply real, permissioned quotes and pass
`placeholder={false}` to remove it. An invented review presented as genuine deceives
buyers and is unlawful in the markets this site serves.

The payment-link band shows the example shop's three **real** products with their real
`buykub.com` URLs and a working copy button each; the slugs were read from the live shop,
not written by hand. Nothing in it mocks up a feature that does not exist.

Photographs are free-licence Unsplash, credited in `public/images/landing/credits.json`
and [`docs/licenses/landing-panels.md`](docs/licenses/landing-panels.md). One candidate was
rejected during sourcing because its page reported `unsplash.com/plus/license`.

Three layout defects were found and fixed by measurement rather than by eye: a
negative-margin bleed whose percentage resolved against the wrong box pushed the page 236px
past the viewport; connector arrows positioned absolutely with no positioned ancestor landed
at x=1460 and x=1656; and the hero image sat flush against the sticky header because
`items-center` plus `h-full` cancelled its margin. The marquee also needed its animation
dropped outright under `prefers-reduced-motion`, since the global reduce rule only shortens
durations and would have parked it on its last frame.

Verification: 614 tests / 117 files, TypeScript, lint (0 errors, 2 pre-existing
unused-variable warnings) and the production build pass; `/` is still statically rendered
with 1m revalidate. Production after promotion: landing, example shop, all three product
pages, login and terms return 200; `/dashboard/*` and `/learn` redirect anonymous visitors;
`POST /api/admin/hold` returns 403. The page carries `รีวิวจากผู้ขาย`, the placeholder
label and the new pricing heading, and no longer contains `ทุกวันจันทร์`,
`จ่ายเฉพาะเมื่อขายได้` or any `buy.stripe.com` reference. Three payment cards and forty
review cards across two lanes render, the row scrolls (−113px in 1.5s) and pauses on hover,
there is no horizontal overflow at 390 or 1440, and the console is clean.

**Not verified:** presentation only — no checkout, payment, refund, product save, payout or
admin write was exercised. The lesson editor, order detail and admin workspace were not
opened in a browser.
