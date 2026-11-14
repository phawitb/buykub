# Public brand and private payout identity

User authorized implementation and deployment without another design approval.

- Audit public source and stored shop/course content for stale test-mode language and personal branding. Keep truthful sandbox safeguards and private authentication/legal account records.
- Confirm configured support email, receipt sender, and Stripe payout destination without disclosing full account numbers.
- Skip login for verified Google sessions, prevent auth redirect loops, and keep brand links pointing to the landing page.
- Replace favicon with an original B mark and improve muted-text contrast.
- Add validated Thai seller identity/contact/address and payout information in an owner-only table. Migrate old payout fields out of publicly readable shops; never store these drafts in browser storage.
- Run focused/full tests, database ownership checks, lint/build, apply migration, deploy, and verify production navigation/settings/public text.

Work split: brand/login agent owns navigation/favicon/contrast; payout agent owns settings/private schema/privacy; root owns copy/data/contact audit, integration and deployment. Preserve unrelated shared workspace changes; no commits.
