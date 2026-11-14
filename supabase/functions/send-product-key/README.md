# Product delivery emails

The existing `send-product-key` function delivers both assigned keys and file
purchase receipts. File receipts link to the persistent BUYKUB checkout page;
the page issues a fresh short-lived private download only for a paid order.

Deploy after `20261112092000_delivery_refunds.sql`. The function explicitly
accepts the Supabase service-role bearer credential or a verified seller JWT
with ownership of the requested order. Seller retries send only the order ID;
the function resolves the delivery token internally. Browser requests cannot
choose the recipient, product key, or download link. Disable gateway JWT
verification when deploying; the handler performs its own authorization check.

Required secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (for example
`BUYKUB <orders@notify.buykub.com>`). Optional `RESEND_REPLY_TO_EMAIL` defaults to
`support@buykub.com`; `BUYKUB_DB_SCHEMA` defaults to `buykub`.

A database lease serializes concurrent sends. The first provider payload is
persisted unchanged and every retry uses `product-delivery-{orderId}` as the
Resend idempotency key. Sent deliveries are not resent. Provider rejection and
unacknowledged database writes return non-2xx, causing the Stripe event to retry.

Resend keeps idempotency keys for 24 hours. An unresolved attempt older than 23
hours stops sending and records a review-required error on the order. Reconcile
it against Resend before any manual recovery; never delete the outbox record or
rotate its key blindly. This prevents duplicate mail after an ambiguous timeout.
Configuration failures before the first provider request do not start that window.
No historical file orders are backfilled or emailed by the migration.

The webhook also needs `STRIPE_SECRET_KEY` for authoritative refund lookup. Add
`charge.refunded`, `refund.created`, `refund.updated`, and `refund.failed` to the
existing checkout event subscription. Full successful refunds revoke new
private downloads and hide keys on the receipt page. Partial, failed, and pending
refunds do not revoke access. A later bank failure after a full successful refund
requires operator review; access is not automatically reissued. Previously
issued download URLs last up to five minutes, and delivered files/keys cannot be
recalled from a customer's device or inbox.
