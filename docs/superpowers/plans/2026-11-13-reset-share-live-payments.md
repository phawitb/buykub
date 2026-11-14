# Reset test catalog, sharing and live readiness

User authorizes deletion of all BUYKUB products/orders for all users, fresh sample content, sharing controls, live Stripe and end-to-end bug checking. Preserve users/shops, unrelated public schema and Stripe accounting history. Do not charge real money without an explicit amount and payment action authorization.

- Inventory and private backup of all buykub data, verify existing orders are test payments. Unpublish old products, cancel pending test sessions/PaymentIntents upstream, then remove checkout links, order-dependent records, orders, lessons and products using snapshotted IDs. Preserve storage objects for rollback.
- Create fresh file and course samples in the authorized dummy shop; validate content/upload, ownership, storefront and buyer access. Use sandbox for completed test payments/refunds before the live switch; no fabricated paid orders.
- Add canonical URL sharing to shop manager/public shop/product; native share with clipboard/manual fallback and accessible feedback.
- Audit checkout/webhook/refund/entitlement boundaries; reject signed events from the wrong Stripe mode before fulfillment.
- Configure live account keys and matching webhook only after concrete access details are reviewed per browser requirements. Verify account readiness and live QR without payment; clearly report any live financial test not executed.
- Scoped/full tests, lint/build, browser checks, production deployment preflight/promotion and live verification. Keep private backups excluded from source/deploy.
