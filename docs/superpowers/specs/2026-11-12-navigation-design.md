# BUYKUB seller workspace redesign

User requested: remove Dashboard home, consolidate its information and incoming orders into Analytics; replace Products with My Shop, an editable storefront (profile/cover/name/bio/accent/product controls), default manage mode with customer-view toggle; remove those appearance fields from Settings; replace My Courses with Purchases covering files and courses; authenticated homepage/logo routes to My Shop.

Approach: retain `/dashboard/products` as My Shop so product creation/edit/lesson URLs remain compatible. `/dashboard` redirects there; `/dashboard/orders` redirects to Analytics orders section, order detail URLs remain. Use a shared storefront presentation for real store and managed preview, with management controls owner-only. Four navigation items: ร้านค้าของฉัน, รายการที่สั่งซื้อ, Analytics, ตั้งค่า. Settings retains account/payout configuration; shop creation and public profile configuration live in My Shop.

Purchases: authenticated server verifies Google account and queries only orders bound to that user; legacy non-course guest orders may match exact confirmed account email only when buyer_user_id is null. Course access remains bound to buyer_user_id and checked by existing course_access. No trusting editable profile email, no shared private caching. Return limited display fields and receipt link, never credentials/private file paths. Refunded/expired items retain history but cannot open paid content. Existing receipt download rechecks refunds.

Analytics: merge existing overview metrics/charts/payout estimate and order filter/list into analytics, avoid repeating order fetches, exclude refunded/pending from paid revenue, validate range. Payout estimates remain clearly estimates; no financial transfer work.

Home routing: signed Google claims in proxy route logged-in `/` to My Shop, guests retain static landing. No global private response caching. Server pages still getUser/RLS. Existing safety/performance improvements retained.

Rulings: user previously explicitly asked to execute without approval; continue existing stack and workspace, no new dependencies/commits, preserve unrelated dirty changes. Use split file ownership for independent implementation, followed by combined review/build/browser verification and authorized production deploy.
