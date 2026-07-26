# Product Key Inventory Implementation Plan

> Execute in order with test-first changes and verification after every vertical slice.

**Goal:** Add secure, atomic product-key inventory and delivery to Framelink while preserving downloadable products and mock payment behaviour.

**Architecture:** Store individual keys in a protected `product_keys` table. Create/update key products through owner-only RPCs and complete purchases through a public, transactional RPC that locks one available key, creates the order, and assigns the key atomically. Deliver the returned key in checkout and invoke a server-side Supabase Edge Function that sends transactional email with Resend.

**Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres/RLS/RPC/Edge Functions, Resend HTTP API, Vitest/Testing Library.

---

## Task 1: Key parsing and product validation

**Files:**
- Modify: `src/features/products/model.ts`
- Create: `src/features/products/product-keys.ts`
- Modify: `src/features/products/validation.ts`
- Modify: `src/features/products/__tests__/validation.test.ts`
- Create: `src/features/products/__tests__/product-keys.test.ts`

1. Write failing tests for normalized line parsing, blank removal, in-batch duplicates, file/key conditional validation, and published key stock validation.
2. Add delivery type, key draft and inventory summary types.
3. Implement the minimal pure parsing and validation logic.
4. Run the focused tests.

## Task 2: Database inventory, RLS, and atomic purchase

**Files:**
- Create: `supabase/migrations/20260726140000_product_key_inventory.sql`
- Modify: `supabase/schema.sql`

1. Add `products.delivery_type`.
2. Add protected `product_keys`, constraints, indexes, timestamps, and RLS.
3. Add order fulfilment-email metadata.
4. Add owner RPCs for product save/import and key status management.
5. Add public stock-count projection/RPC.
6. Add atomic `complete_mock_key_purchase` RPC with row locking and database-authoritative pricing.
7. Add retry-safe email status update contract for the service role.
8. Validate SQL locally using Supabase CLI/database tools available in the repository.

## Task 3: Product key editor

**Files:**
- Create: `src/features/products/components/ProductKeyInventory.tsx`
- Create: `src/features/products/components/__tests__/ProductKeyInventory.test.tsx`
- Modify: `src/features/products/components/ProductEditor.tsx`
- Modify: `src/features/products/components/__tests__/ProductEditor.test.tsx`
- Modify: `src/app/dashboard/products/new/page.tsx`
- Modify: `src/app/dashboard/products/[id]/edit/page.tsx`

1. Write failing component tests for delivery cards, key import summary, conditional file UI, inventory counts, disabling/re-enabling keys, and assigned-key immutability.
2. Build delivery-type controls and the one-key-per-line importer.
3. Make save payloads conditional and route key saves through the owner RPC.
4. Load inventory safely for edit mode.
5. Ensure existing file product create/edit tests remain green.

## Task 4: Storefront stock and sold-out controls

**Files:**
- Modify: `src/features/storefront/ProductCard.tsx`
- Modify: `src/features/storefront/ProductCard.test.tsx`
- Modify: `src/features/storefront/ProductGrid.tsx`
- Modify: `src/features/storefront/ProductGrid.test.tsx`
- Modify: `src/app/[slug]/page.tsx`
- Modify: `src/app/[slug]/[productSlug]/page.tsx`
- Modify: `src/app/[slug]/[productSlug]/ProductPurchase.tsx`

1. Write failing tests for available, low-stock, and sold-out labels.
2. Include stock counts in server product projections.
3. Render stock on product cards and product detail.
4. Disable both purchase controls and prevent checkout opening at zero.
5. Run storefront tests.

## Task 5: Atomic checkout and buyer key delivery

**Files:**
- Modify: `src/features/storefront/MockCheckout.tsx`
- Modify: `src/features/storefront/__tests__/MockCheckout.test.tsx`
- Create: `src/features/storefront/checkout.ts`
- Create: `src/features/storefront/__tests__/checkout.test.ts`

1. Write failing tests for RPC request mapping, sold-out races, key success state, Copy interaction, no duplicate order after success, and email-state messaging.
2. Replace direct key-order inserts with the atomic RPC.
3. Preserve the existing file-product mock checkout path.
4. Reveal the returned key only in the in-memory success view.
5. Trigger transactional email delivery after fulfilment without rolling back the assigned key on email failure.
6. Run focused checkout tests.

## Task 6: Real Resend email delivery

**Files:**
- Create: `supabase/functions/send-product-key/index.ts`
- Create: `supabase/functions/send-product-key/email.ts`
- Create: `supabase/functions/send-product-key/email.test.ts`
- Create: `supabase/functions/send-product-key/README.md`
- Modify: `.env.example` if present

1. Write failing pure tests for HTML/text email content, escaping, and secret-safe error mapping.
2. Implement the Edge Function using Resend's HTTPS API and service-role database lookup.
3. Accept order ID only; reload the assigned key server-side.
4. Record pending/sent/failed status and attempts.
5. Document and configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
6. Run Edge Function unit tests.

## Task 7: Seller order fulfilment management

**Files:**
- Modify: `src/app/dashboard/orders/[orderId]/page.tsx`
- Modify: `src/app/dashboard/orders/[orderId]/OrderActions.tsx`
- Modify: `src/app/dashboard/orders/[orderId]/OrderActions.test.tsx`
- Modify: `src/app/dashboard/orders/page.tsx`

1. Write failing tests for assigned-key display, email delivery status, resend action, and refund preserving stock.
2. Load the assigned key only for the authenticated shop owner.
3. Add Copy and Retry email controls.
4. Keep refund limited to order status.
5. Run focused order tests.

## Task 8: End-to-end regression and release verification

**Files:**
- Update tests only where required by verified behaviour.

1. Run all Vitest tests.
2. Run ESLint.
3. Run TypeScript checking.
4. Run Next production build.
5. Exercise create/edit key product, final-key checkout, copy, email status, sold-out, seller order detail, refund, and file-product regression in the browser.
6. Fix all failures and repeat the full verification suite.
7. Review the worktree diff for secrets, plaintext-key leaks, accidental unrelated changes, and migration/schema parity.

