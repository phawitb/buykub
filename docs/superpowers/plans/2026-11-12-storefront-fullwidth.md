# Implementation checklist

- [x] Inspect current storefront, identity/navigation and checkout paths; snapshot current source.
- [x] Full-width storefront with modal icon editing and responsive product grid.
- [x] Google-only checkout for every product type and verified delivery email.
- [x] Buyer-only navigation, explicit shop creation, and merchant route redirects.
- [x] Independent review, regression suite, lint and production build.
- [x] Local browser checks, preview deployment, production promotion and live read-only verification.
- [ ] Post-deployment click-through and screenshot-file capture: Mac locked; user unlock requested.

Production database: Google checkout guard and all-product account binding applied and verified. Anonymous reservations denied; authenticated checkout generated Stripe Test Mode QR without manual email entry. No payment made.

Release: dpl_7ewwkU1Brn8pj4m5U2H9c1VrsJ4m promoted to buykub.com; sin1. 430 tests/94 files and 5 SQL regression suites pass; lint, local webpack and Vercel builds pass. Local browser confirmed full-width desktop/mobile layouts, appearance modal, add/edit modals, unchanged dummy product save, and Back/Forward draft restoration. Live authenticated storefront renders new UI; public store HTTP200, anonymous checkout HTTP401, protected workspace HTTP307 to Google login. No new payment made.
