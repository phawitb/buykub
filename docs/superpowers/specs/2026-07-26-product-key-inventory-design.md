# Product Key Inventory and Delivery Design

**Date:** 2026-07-26  
**Status:** Approved in conversation  
**Scope:** Product authoring, storefront stock, mock checkout fulfilment, buyer delivery, seller order management, transactional email, database security, and regression coverage.

## Goal

Allow a seller to create a product whose fulfilment is one unique product key per paid order. Sellers import and manage a list of keys, buyers see the remaining quantity, sold-out products cannot be purchased, and a successful checkout reveals the assigned key immediately and sends it to the buyer's email address.

The existing downloadable-file product remains supported. Booking services are unaffected.

## Confirmed Product Rules

- A product uses exactly one delivery type: `file` or `key`.
- A key product requires at least one available key before it can be published.
- One checkout purchases one unit and receives one key.
- A key may be assigned to at most one order.
- Stock is the count of keys whose status is `available`.
- When stock reaches zero, all storefront purchase controls are disabled and show a sold-out state.
- A refunded order does not return its key to stock automatically.
- Buyers receive their assigned key both on the checkout success screen and through a real transactional email.
- Email failure does not undo a paid order or return its key. The buyer can still copy the key on screen, while the seller can retry delivery.

## Data Model

### Products

Add:

- `delivery_type text not null default 'file' check (delivery_type in ('file', 'key'))`

File metadata continues to live on the product for file products. Key products do not expose key values or file metadata in public product queries.

### Product Keys

Create `product_keys`:

- `id uuid primary key`
- `product_id uuid not null references products on delete cascade`
- `key_value text not null`
- `key_fingerprint text not null`
- `status text not null check (status in ('available', 'assigned', 'disabled'))`
- `assigned_order_id uuid null`
- `assigned_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Constraints and indexes:

- Unique `(product_id, key_fingerprint)` prevents duplicate keys within a product without relying on plaintext comparisons.
- Unique partial index on `assigned_order_id` when non-null.
- Index `(product_id, status, created_at)` supports stock counts and deterministic assignment.
- Assigned rows must have an order and assignment time; available/disabled rows must not.

`key_fingerprint` is a normalized cryptographic digest used only for duplicate detection. `key_value` is retained because the buyer and seller must be able to retrieve the delivered value. It must never be returned by public product endpoints.

### Orders

Add email delivery metadata:

- `fulfilment_email_status text` with `pending`, `sent`, or `failed`
- `fulfilment_email_attempts integer not null default 0`
- `fulfilment_email_last_error text`
- `fulfilment_email_sent_at timestamptz`

The assigned key is reached through `product_keys.assigned_order_id`. Orders remain the audit record when refunded.

## Security and RLS

- Public visitors cannot select from `product_keys`.
- Shop owners can read and manage keys only for products belonging to their own shop.
- Assigned keys cannot be edited, deleted, disabled, or returned to available through normal owner policies.
- Public clients cannot insert paid key orders directly.
- A security-definer database function performs key checkout with a deliberately narrow input and return contract.
- The function validates that the product and shop are published, delivery type is `key`, price comes from the database, and a key is available.
- The function returns only the newly created order ID and its single assigned key.
- Email sending uses server-held credentials and never exposes `RESEND_API_KEY` to the browser.

## Seller Product Editor

### Delivery Type

Add a delivery section with two cards/radio controls:

- Digital file
- Product key

Switching type changes the fulfilment editor. Unsaved values may remain in local component state while switching so accidental clicks do not discard work, but only fields for the selected type are persisted.

### Key Import

The key editor provides:

- A multiline input accepting one key per line.
- Whitespace trimming and empty-line removal.
- Exact duplicate removal after normalization.
- A preview summary: valid new keys, duplicates in the pasted batch, duplicates already stored, and blank rows ignored.
- A clear confirmation action before importing into an existing product.
- Validation that no individual key is empty after normalization and that batch/input limits are respected.

For a newly created product, keys are held in editor state and saved with the product. For an existing product, new batches are persisted only when the main Save action succeeds so product editing retains the established save model.

### Inventory Management

Existing key products display:

- Available count
- Sold count
- Disabled count
- Searchable/paginated key rows
- Masked key values by default, with an explicit reveal action
- Status and assignment/order metadata
- Ability to disable an available key
- Ability to re-enable a disabled, never-assigned key

Assigned keys are immutable. History is never destroyed from the UI.

### Validation

- File products require a product file.
- Key products require at least one available key to publish.
- A key product may be saved as a draft with zero stock.
- Changing an existing key product to file delivery is blocked while assigned key history exists; the seller must create a separate product instead.

## Storefront

Public product projections include `available_key_count`, never key rows or values.

For key products:

- Show `เหลือ X รายการ` near the price/purchase area.
- Low stock (a small positive quantity) receives stronger visual emphasis.
- At zero, show `สินค้าหมด`.
- Disable the primary and sticky purchase buttons.
- Prevent opening checkout when sold out.

The database remains authoritative. A stale page that shows stock still cannot oversell.

## Atomic Checkout and Key Assignment

Create a database RPC such as `complete_mock_key_purchase`:

1. Validate buyer email and payment method.
2. Lock the product row and read its current shop, price, publication, and delivery type.
3. Select one available key using row locking (`FOR UPDATE SKIP LOCKED`) in deterministic creation order.
4. If none is available, return a typed sold-out result/error.
5. Insert the paid mock order using the database price.
6. Mark the key assigned and link it to the order.
7. Commit both changes together.
8. Return order ID and assigned key to the calling checkout.

No state exists where an order succeeds without a key or one key is assigned twice. Concurrent attempts for the last key yield one success and one sold-out response.

File-product checkout may keep its existing path initially, but shared checkout response types should make the fulfilment mode explicit.

## Buyer Delivery

After a key checkout succeeds:

- Replace the checkout form with a success state containing the assigned key.
- Provide a labelled Copy button and accessible copied confirmation.
- Warn the buyer to save the key before closing.
- Show whether the delivery email was sent, is being sent, or could not be sent.
- Closing and reopening checkout must not create another order. The success state remains for that component session.

The returned key is held only in memory on the buyer page. It is not put in the URL, analytics payload, local storage, or console logs.

## Transactional Email

Use a Supabase Edge Function with Resend:

- Required secret: `RESEND_API_KEY`
- Required sender configuration: `RESEND_FROM_EMAIL`
- The sender domain must be verified in Resend.
- Email contains shop name, product name, order reference, assigned key, and support wording.
- Plain-text and HTML bodies are both provided.

Flow:

1. Atomic checkout creates the order/key assignment with email status `pending`.
2. Server-side delivery invokes the Edge Function with the order identity, not a caller-supplied key.
3. The function reloads the authorized order and assigned key from the database.
4. On success it records `sent`, timestamp, and attempt count.
5. On failure it records `failed`, sanitized error, and attempt count.
6. Checkout returns the key regardless of email outcome.

Seller order detail includes email state and a Retry email action. Retry is idempotent at the order level and never assigns another key.

## Refund Behaviour

Refund changes only the order status. The assigned key remains assigned and visible in the audit trail. It does not affect available stock. If a replacement is required, the seller adds new stock and handles the replacement as an explicit later workflow.

## Error Handling

- Duplicate imports report counts without silently creating duplicate rows.
- A sold-out race produces a friendly sold-out message and refreshes displayed stock.
- Network/database failures preserve the form and allow retry.
- Email failure is presented separately from payment/fulfilment success.
- Secrets and full key values are excluded from logs and analytics.

## Testing Strategy

### Unit and component tests

- Delivery-type validation.
- Key parsing, trimming, blank removal, normalization, and deduplication.
- Import summaries and inventory status controls.
- File products still require files; published key products require stock.
- Stock count, low-stock, and sold-out storefront rendering.
- Both regular and sticky purchase buttons are disabled at zero stock.
- Checkout success reveals the assigned key and Copy works.
- Email success/failure/pending messaging.
- Seller retry action and immutable assigned-key controls.
- Refund does not increment stock.

### Database integration tests

- Owner-only key access.
- Public users cannot enumerate keys.
- Atomic order and assignment.
- Two concurrent purchases for one remaining key yield exactly one order/key assignment.
- Database price is authoritative.
- Duplicate fingerprint constraint.
- Assigned key cannot be returned to stock by ordinary writes.

### End-to-end tests

- Create a key product from an imported list.
- Visit the storefront, purchase, copy the key, and observe stock decrement.
- Confirm the seller order shows the same assigned key.
- Confirm email delivery status and retry behaviour.
- Purchase the final key and verify the sold-out UI.
- Refund the order and verify stock remains zero.
- Regression test downloadable-file product create/edit/checkout.

## Rollout and Compatibility

- Existing products are migrated to `delivery_type = 'file'`.
- Schema changes are additive.
- The new public stock projection/function must be deployed before the UI that consumes it.
- Resend secrets and verified sender are required before production email verification.
- Mock payments remain clearly labelled; key allocation itself is real and consumes inventory.

