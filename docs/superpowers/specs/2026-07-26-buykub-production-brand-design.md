# BUYKUB Production Brand Design

## Goal

Replace the customer-facing FRAMELINK brand with BUYKUB and make
`buykub.com/{shop-slug}` the canonical public shop URL without changing the
existing route structure or weakening the current mock-payment disclosures.

## Brand System

- The customer-facing wordmark is `BUYKUB` in uppercase.
- `BUY` uses the existing primary ink color.
- `KUB` uses a left-to-right gradient from `#2563EB` to `#7C3AED`.
- The wordmark must remain text-based and accessible. Its accessible name is
  `BUYKUB`.
- Shared brand constants provide the product name, public origin, support
  email, and order email sender name. Components must not duplicate these
  values.

## Public URLs

- The canonical production origin is `https://buykub.com`.
- Shop URLs use `https://buykub.com/{shop-slug}`.
- Existing application routes remain `/{slug}` and `/{slug}/{productSlug}`;
  no redirect layer or database migration is required.
- Dashboard copy, copy-link actions, onboarding examples, featured shops,
  testimonials, and metadata use the BUYKUB domain.
- Local development continues to run on localhost; displayed public shop links
  intentionally use the production domain.

## Customer Contact and Email

- Public support and legal contact is `support@buykub.com`.
- Product-key emails use the sender display name `BUYKUB`.
- Product-key email replies go to `support@buykub.com`.
- The verified Resend mailbox remains `orders@mail.buykub.com`.
- Secrets remain deployment configuration and must not be committed.

## Scope

The change covers:

- shared wordmark and brand constants;
- landing page, authentication, dashboard, settings, storefront, metadata,
  Terms, and Privacy copy;
- product-key email templates and function defaults/documentation;
- canonical public URL generation and copy-link behavior;
- regression tests for the brand, domain, support address, and email identity.

The change does not cover:

- a real payment gateway, refunds, payouts, or fee collection;
- a new routing scheme;
- Google OAuth verification;
- DNS or hosting-provider account changes that cannot be derived from an
  existing deployment configuration.

Mock checkout and booking payment disclosures remain visible until a real
payment system is implemented.

## Architecture

Create a small server-safe brand module containing immutable values and URL
helpers. UI components import the shared values instead of embedding
`FRAMELINK`, `framelink.app`, or legacy contact addresses. The wordmark remains
a reusable component so the same accessible and visual treatment is used on
the landing page, login, dashboard, and public storefront where applicable.

The Edge Function cannot import the Next.js application module, so it keeps
deployment-safe defaults that exactly match the shared brand contract. Its
tests verify the sender name and reply-to address.

## Error Handling

- URL helpers normalize leading and trailing slashes and safely encode shop
  slugs where a full URL is constructed.
- Missing Resend configuration continues to fail explicitly rather than
  silently reporting email delivery.
- Rebranding does not change checkout, order creation, inventory allocation,
  or OAuth behavior.

## Testing and Verification

- Unit tests verify the brand constants and canonical shop URL helper.
- Component tests verify the split-color BUYKUB wordmark and accessible name.
- Existing page and email tests are updated to expect BUYKUB values.
- A source-level regression check prevents customer-facing legacy brand/domain
  strings from remaining outside historical documentation and migrations.
- Run the full test suite, lint, TypeScript check, and production build.
- Verify key pages in the browser at desktop and mobile widths.
- Merge the verified feature branch into `main` only when both worktrees are
  clean and the merge is fast-forwardable.

## Deployment Boundary

After merging, inspect the repository for an existing hosting configuration.
If one exists, deploy using that provider's required workflow. If none exists,
stop before creating an external hosting project and report the exact missing
provider decision and DNS records required for `buykub.com`.
