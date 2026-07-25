# Single-plan pricing design

## Goal

Remove the Free, Pro, and Pro+ subscription model. Every Framelink shop receives the same capabilities without choosing or paying for a plan.

## Customer-facing offer

- No subscription plan or recurring membership fee
- 5% fee per order
- Unlimited products
- Unlimited booking services
- No Framelink watermark
- Payouts every Monday

## Marketing site

The Pricing section keeps its existing section position and visual language but uses one centered offer card. It must not present a plan selector, billing period, upgrade CTA, or comparison between tiers. The FAQ must describe the single 5% transaction fee and confirm that there are no entry, monthly, or hidden plan fees.

## Dashboard

Remove the Free badge, Pro upgrade card, upgrade links, and membership summary. Settings should state the universal commercial terms where useful, without presenting them as a selected plan. Product and booking creation must not enforce tier limits.

Requests to `/dashboard/settings/upgrade` redirect to `/dashboard/settings`. The old plan cards, comparison table, mock subscription checkout, and their tests are deleted.

## Cleanup

Remove unused plan components and all user-facing references to Free, Pro, Pro+, tier upgrades, 8%, 2%, 0%, five-product limits, and watermarks that imply a paid tier. Product names or unrelated technical uses of the words are outside this cleanup.

No database migration is required because the current plan UI is mock-only and no active billing entitlement controls these capabilities.

## Verification

- Landing tests assert the single offer and every promised benefit.
- Dashboard tests or source scans assert that obsolete upgrade UI is absent.
- The upgrade route test asserts a redirect to Settings.
- Run the focused tests first, followed by the full test suite, lint, typecheck, and production build.

