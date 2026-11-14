# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Thai individual sellers of digital goods — downloadable files, software/product
keys, and paid courses. They have something to sell and a social audience (LINE, Facebook,
Instagram, TikTok), but no store, no payment setup and no appetite for infrastructure. The
job is: turn a file or a course into a link they can paste into a bio or a chat and get paid
for, without talking to a developer.

Secondary: Thai buyers arriving from a pasted link. They are not browsing a marketplace —
they land on one seller's shop or one product, and they decide there. Buyers must sign in
with Google before paying; the account they pay with is the account that owns the purchase.

Platform operator: a single administrator (`phawit.boo@gmail.com`) who moderates shops and
products and prepares seller payouts by hand.

## Product Purpose

BUYKUB lets a Thai seller open a storefront, upload a product and take money for it in one
sitting. Delivery is automatic — a file download, a product key from stock, or access to a
course classroom — so a sale completes while the seller is asleep. Success is a seller who
pastes their link somewhere and receives a confirmed, paid, delivered order without doing
anything else.

## Positioning

A pasteable link, not a marketplace. There is no BUYKUB catalog, no search across sellers,
no discovery surface competing with the seller's own audience: the seller's shop URL and
product URLs are the product. Delivery is specific rather than generic — file downloads
through short-lived private links, atomic product-key inventory that cannot double-sell, and
a course classroom with per-order access windows — and the money path is Thai: PromptPay QR
and cards through Stripe in THB.

## Operating Context

- Sellers work from a phone as often as a laptop, and compose products in Thai.
- The seller workspace has four destinations: My Shop (`/dashboard/products`), Purchases
  (`/learn`), Analytics, Settings. My Shop doubles as the storefront editor — the seller
  edits profile, cover, title and bio directly on a live preview of their own shop.
- Public surfaces: the landing page, `/[slug]` (a shop), `/[slug]/[productSlug]` (a product),
  Google sign-in, the PromptPay/Stripe checkout, and the receipt page.
- Buyers read receipts in email. Receipt links are treated as capability links, not public
  pages, and signed download URLs expire in five minutes.
- Product authoring includes a rich text editor with YouTube embeds and private documents;
  courses carry ordered lessons that must be published before the listing can go live.
- Payouts are staff-operated: prepare a batch, transfer by hand, attest with a reference and
  attach a slip. No bank API is connected.

## Capabilities and Constraints

- Next.js 16.4.6 (App Router, Turbopack), React 19.2.4, Tailwind CSS 4, TypeScript.
  Read `node_modules/next/dist/docs/` before touching framework code — this Next.js version
  has changed APIs.
- Supabase (isolated `buykub` schema, RLS forced) for data, auth and storage; Stripe 22 for
  payment; Resend for email. Deployed on Vercel in `sin1`.
- Thai is the interface language. Copy is Thai; the type stack is `--font-thai-sans`.
- Google is the only sign-in method. Protected pages authorize on the server; client metadata
  grants nothing.
- Landing HTML is static and CDN-cached, with the account menu hydrated separately. Anonymous
  catalog reads are cached 60s. Any visual work must keep the landing statically renderable
  and must not move authorization or private data into cached or client-visible payloads.
- `prefers-reduced-motion` is already honored globally and must stay honored.
- Stripe runs on live keys. Booking/Calendar features are deliberately paused and hidden.

## Brand Commitments

- Name `BUYKUB`, domain `buykub.com`, support `support@buykub.com`, receipts from
  `orders@notify.buykub.com`. Defined in `src/lib/brand.ts` and asserted by tests.
- The original `B` mark (`src/app/icon.svg`, `src/app/favicon.ico`) stays.
- Voice is plain Thai, seller-to-seller, no hype. The landing speaks to sellers.
- **Binding visual constraint from the user (2026-11-14):** this is a refinement, not a
  rebrand. Keep the incumbent direction — indigo accent `#5046e5`, light paper ground, the
  existing page structure and copy — and improve spacing, hierarchy, typography, motion and
  detail craft across every surface.
- No invented claims: no testimonials, customer counts, benchmarks or press logos.
- Published commercial terms state a 5% platform fee; that number is a commitment.

## Evidence on Hand

- `README.md` carries the release history and the honest limits of each release, including
  what is verified and what is not. It is the source of truth for product claims.
- Live production site: https://buykub.com. Demo shop: `/buykub-store`.
- Pricing/terms copy lives in `src/components/Pricing.tsx`, `src/app/terms/page.tsx`,
  `src/app/privacy/page.tsx`.

## Open Decisions

- Paid live settlement and live refunds are not yet exercised end to end; no marketing copy
  may imply they are proven.
- Automatic seller bank transfers do not exist. Nothing in the UI may suggest they do.
