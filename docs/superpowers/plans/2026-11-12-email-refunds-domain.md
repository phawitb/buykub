# Email, refund synchronization, and domain repair

User requests working post-payment customer email, automatic refund updates, and repair of previously working Porkbun domain. Existing authorization is to implement and configure; preserve all existing unrelated data/work.

## Approach
Continue existing Next.js/Supabase buykub/Stripe/Resend/Vercel services. Send file receipt links and assigned keys only after confirmed payment. Persist fulfillment state and retry errors idempotently. Synchronize successful Stripe refunds, deny downloads after full refund, distinguish partial/pending refunds, and handle duplicated/out-of-order events. No policy for unsolicited automatic monetary refunds is invented. User clarification pending for any seller refund initiation UI.

## Tasks
- [x] Agent: regression tests and implementation for customer email and refund reconciliation, SQL migrations, seller status/retry and buyer refund UI.
- [x] Main: diagnose DNS, verify Vercel project, repair www routing and production connection while preserving email DNS and unrelated subdomains.
- [x] Main: verify existing Resend domain/account, configure sender credentials in Supabase without exposing secrets.
- [x] Apply migration and deploy reviewed handlers; configure webhook events and test credentials.
- [x] End-to-end test authorized recipient email, partial/full Stripe sandbox refund and download revocation; failure/retry and idempotency covered by handler regression tests.
- [x] Verify production domain, auth redirects and updated build; full tests/typecheck/lint and review.

## Current evidence
- buykub.com returns HTTP 200 from Vercel; www.buykub.com follows wildcard uixie.porkbun.com to a retired Link-in-bio 404.
- Porkbun registration valid through 2027-07-26. Existing mail.buykub.com Resend DKIM/SPF/MX records exist.
- Local project .vercel/project.json identifies buykub prj_0xx9WEM6ESZzUpD8KSeYTY2giDqq. CLI credentials absent.
- Automatic review blocked Google sign-in to Vercel/Resend pending explicit account identification. User question sent; no bypass attempted.

## Review focus
No unpaid/refunded order emails or downloads; no email recipient supplied by untrusted request; provider timeout and duplicate events cannot duplicate email; partial/pending/failed refunds cannot revoke incorrectly; old email DNS, existing subdomains and legacy public tables preserved.

## Deployed and verified
- Applied final 092000 migration to buykub-th; dashboard returned success. Includes order-update restrictions and service-role-only delivery/refund RPCs; legacy public schema remains untouched.
- Deployed send-product-key and stripe-webhook, configured existing Stripe test API credential and mail.buykub.com sender. Resend API key still missing pending user account confirmation.
- Added all four refund events to the current test webhook. Test order 6d5977ac-0fb7-4d0d-838d-e54baa1f30a9: 1000 satang partial refund kept receipt completed/download303; remaining4000 full refund changed receipt to refunded/download403. Actual Stripe events drove the updates, no manual status update.
- Porkbun explicit www forward to https://buykub.com, non-wildcard, URI preserved. HTTPS www/dashboard/orders returns302 to correct apex path; apex A remains76.76.21.21 and returns200.
- Vercel CLI successfully authenticated as phawitb. Updated only four public production connection values; attempted all-env download was rejected by automatic review and not retried. No production secret bundle was downloaded.
- First staged Vercel deployment built successfully; hosted checkout created a cs_test session in the same Stripe account. Expired that unpaid staging checkout. Promoted dpl_HNAYtTQgunQGcnG3ygpUvV5JET7C.
- Production product detail exposed existing CommonJS/ESM incompatibility in jsdom. Added failing subprocess test matching runtime, then upstream-recommended isomorphic-dompurify/jsdom25.0.1 override; test passed. Updating packages with published critical advisories before second deployment.
- Independent review found no remaining important issues. 220 tests passed before runtime regression; 221 passed with override. Final dependency/build verification pending.

## User input resolved
- Vercel account phawit.boo@gmail.com; Resend account inklabs.contact@gmail.com. User completed Resend login, authorized the domain-scoped sending key and its storage in buykub-th, and selected phawit@binabik.ai for the test receipt.

## Final verification
- Next.js/eslint-config-next upgraded to16.4.6; DOMPurify3.4.17. Critical npm audit advisories cleared; remaining non-critical dependency advisories were not broadly auto-fixed (45 total:9high/36moderate in full dependency audit).
- Final full suite:221 tests in65 files passed; typecheck, focused ESLint and diff whitespace check passed. New server sanitizer regression failed before override, then passed with script/JavaScript-URL filtering intact.
- Final Vercel deployment dpl_2oJuDe4LFFqGvTre72nszmzhNxcd built successfully. Tested actual product route on protected staged URL:200 and expected product content, then promoted to buykub.com.
- Canonical login, product detail and www product link all return200; www preserves path. Refunded canonical download returns403. Browser visually confirms live product title/price/buy button and refunded local receipt without download button.
- Supabase Site URL=https://buykub.com; allowlist retains localhost callback and canonical callback.
- Local dev server restarted on3000 with Next16.4.6 (session93969). Temporary SQL test PostgreSQL stopped. Temporary copied Stripe secret deleted. No git commit/push.
- Email implementation deployed but end-to-end send remains blocked by missing Resend login/API-key configuration and recipient confirmation. No customer email has been sent in this task.

## Vercel agent onboarding follow-up

User requested https://vercel.com/get-started.md; fetched and followed.
- CLI 57.0.0 verified authenticated as phawitb.
- Official vercel/vercel-plugin installed through `npx plugins add vercel/vercel-plugin --target codex --scope user --yes`; installer selected vercel@openai-curated, version 0.21.4, enabled in user configuration. Status command exists in installed package.
- Shared global MCP entry added at https://mcp.vercel.com in /Users/phawit/.codex/config.toml; OAuth completed successfully and `codex mcp list` reports enabled/OAuth.
- Current chat has no newly loaded Vercel MCP tools; search_vercel_documentation and list_teams still need verification after tools reload/restart. No MCP mutation performed.
- Production deployment dpl_2oJuDe4LFFqGvTre72nszmzhNxcd verified Ready; local login returned 200.
- User supplied phawit@binabik.ai as post-payment test email recipient. Resend login/API key still pending; no email sent.

## Email setup completed — 2026-11-12

- Resend team inklabs.contact had no domains or keys. Added notify.buykub.com in Tokyo; preserved the existing mail.buykub.com DNS and all unrelated records.
- Porkbun DNS added: TXT resend._domainkey.notify (Resend DKIM), CNAME rsend.notify -> rsend-apne1.forge.rmta.net, CNAME send.notify -> send.forge.rmta.net. Public DNS matched; Resend domain 82489514-97a9-45ea-aa19-311db036df31 became Verified.
- Created BUYKUB order emails with Sending access restricted to notify.buykub.com. Stored RESEND_API_KEY in Supabase and set RESEND_FROM_EMAIL=BUYKUB <orders@notify.buykub.com>. No key persisted in repository or printed in logs. An initially masked UI value was immediately corrected before testing.
- Real storefront checkout using Stripe's test card, THB50, reached the successful receipt page. Order reference #9174AD82 sent automatically through the deployed webhook/function to the authorized recipient phawit@binabik.ai.
- Resend message 01a1cee7-032e-70ba-a085-df24db9300cd: Sent and Delivered at 08:36 UTC. Sender orders@notify.buykub.com; reply-to support@buykub.com; receipt link uses canonical buykub.com. This supersedes the earlier pending-email notes above.
- Download from that receipt returned the expected 118-byte test file, SHA256 993eea1f23b87447c81940a5fba2ede8f04e32cbd91286ecc96cb76a3f92b542. Prior partial/full refund evidence remains valid. No real payment was charged.
- This follow-up changed service configuration and documentation only; no application code changed after the previously passing 221-test suite. No production email failure was deliberately injected and no historical orders were emailed.
