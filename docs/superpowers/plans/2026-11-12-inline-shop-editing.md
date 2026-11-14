# Direct shop editing

User delegates design and execution without approval gates; continue existing dirty workspace without committing unrelated work.

1. Make profile, cover, shop title and bio directly editable in management mode through separate small dialogs. Keep public/customer views free of edit controls. Name dialog includes URL; new-shop flow retains required name and URL. Empty bio has an add-description affordance.
2. Remove accent controls and related copy, preserving existing stored appearance values for compatibility. Use a prominent labeled Add product action.
3. Simplify product creation to Course/File and derive storefront badges from delivery type; preserve legacy key inventory/order behavior when editing existing records. Existing arbitrary category values must not surface as badges.
4. Verify scoped interactions and category persistence, full tests/lint/build, independent review and browser desktop/mobile flows. Deploy to Vercel, preflight, promote buykub.com and verify live. Do not alter test product/shop data without restoring it; no payment needed.
