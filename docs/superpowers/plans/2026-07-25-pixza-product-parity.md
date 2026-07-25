# PIXZA Product Experience Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build EasySell's complete PIXZA-parity product workflow from product authoring and real upload progress through storefront cards, dedicated product details, and a non-charging mock checkout.

**Architecture:** Server route components load authorized Supabase data while focused client components manage editor state, upload tasks, galleries, and checkout interaction. Product data is normalized through a shared domain module, product files move to private storage, product images remain public, and legacy rows remain readable during migration.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, Supabase Auth/Postgres/Storage, Tiptap, Vitest, Testing Library, jsdom.

## Global Constraints

- Preserve EasySell branding; do not copy PIXZA logos, merchant content, media, or proprietary marketing copy.
- Match PIXZA's information hierarchy, layout, spacing, card proportions, button positions, responsive navigation, and interaction states as closely as practical.
- Remove all AI Builder UI and do not introduce an AI Builder route or placeholder.
- Thai is the primary UI language.
- Product files accept one file up to exactly 500 MB and are private.
- Product images accept at most five JPEG, PNG, or WebP files up to exactly 5 MB each.
- Upload progress must use transmitted bytes, support cancellation and retry, and remain independent per image.
- Rich-text descriptions allow at most 5,000 visible text characters and render only sanitized HTML.
- Checkout is a working mock that creates a mock order but never invokes a payment provider or sends money.
- Existing product rows remain readable throughout migration.
- Before changing Next.js route or component behavior, read the matching files under `node_modules/next/dist/docs/01-app/`, especially `03-api-reference/03-file-conventions/dynamic-routes.md`, `03-api-reference/03-file-conventions/page.md`, `01-getting-started/04-linking-and-navigating.md`, and `01-getting-started/05-server-and-client-components.md`.

---

## File Map

### Database and domain

- `supabase/schema.sql`: additive product/order fields, product slug uniqueness, private product-file bucket, image bucket policies.
- `src/features/products/model.ts`: product, FAQ, image, editor, and upload types.
- `src/features/products/validation.ts`: editor validation, MIME/size checks, text counting, and price rules.
- `src/features/products/slug.ts`: stable product slug generation and collision suffixing.
- `src/features/products/format.ts`: Thai currency, byte size, and discount formatting.
- `src/features/products/__tests__/validation.test.ts`: domain validation and formatting tests.
- `src/features/products/__tests__/slug.test.ts`: slug behavior tests.

### Upload and editor

- `src/lib/supabase/upload.ts`: cancellable progress-aware storage upload transport plus delete helper.
- `src/features/products/upload-task.ts`: upload task state reducer and orchestration.
- `src/features/products/__tests__/upload-task.test.ts`: task transition tests.
- `src/features/products/components/ProductEditor.tsx`: shared create/edit form and save behavior.
- `src/features/products/components/RichTextEditor.tsx`: Tiptap toolbar and 5,000-character enforcement.
- `src/features/products/components/ProductFileUploader.tsx`: one-file drop zone and progress card.
- `src/features/products/components/ProductImageUploader.tsx`: five-image queue, previews, reordering, and progress cards.
- `src/features/products/components/RepeatableFields.tsx`: highlights and FAQ editing.
- `src/features/products/components/__tests__/ProductEditor.test.tsx`: editor integration tests.
- `src/app/dashboard/products/new/page.tsx`: create-page loader.
- `src/app/dashboard/products/[id]/edit/page.tsx`: edit-page loader and authorization.
- `src/app/dashboard/products/new/ProductNewForm.tsx`: removed after shared editor replaces it.

### Merchant list

- `src/app/dashboard/layout.tsx`: PIXZA-like navigation structure without AI Builder and responsive bottom navigation.
- `src/app/dashboard/products/page.tsx`: product list data and parity layout.
- `src/app/dashboard/products/ProductRow.tsx`: thumbnail, publication state, preview/edit/delete controls.
- `src/app/dashboard/products/ProductActions.tsx`: mutation state, confirmation dialog, and errors.

### Public product experience

- `src/features/storefront/ProductCard.tsx`: accessible square storefront card.
- `src/features/storefront/ProductGallery.tsx`: active-image gallery.
- `src/features/storefront/MockCheckout.tsx`: validated non-charging checkout.
- `src/features/storefront/__tests__/MockCheckout.test.tsx`: mock checkout tests.
- `src/app/[slug]/page.tsx`: PIXZA-parity storefront composition and product links.
- `src/app/[slug]/[productSlug]/page.tsx`: product detail loader, not-found handling, and metadata.
- `src/app/[slug]/[productSlug]/ProductPurchase.tsx`: detail CTA and checkout state.
- `src/app/[slug]/BuyButton.tsx`: removed after checkout is moved to the detail route.
- `src/app/globals.css`: shared visual tokens, rich-text prose, focus, progress, and storefront styles.

### Route states and verification

- `src/app/[slug]/loading.tsx`: storefront loading shell.
- `src/app/[slug]/[productSlug]/loading.tsx`: detail loading shell.
- `src/app/[slug]/[productSlug]/not-found.tsx`: product not-found surface.
- `vitest.config.ts`: jsdom test environment and path aliases.
- `src/test/setup.ts`: Testing Library matchers and browser API stubs.
- `package.json`: test/typecheck scripts and dependencies.

---

### Task 1: Test Harness and Product Domain Contracts

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/features/products/model.ts`
- Create: `src/features/products/validation.ts`
- Create: `src/features/products/slug.ts`
- Create: `src/features/products/format.ts`
- Test: `src/features/products/__tests__/validation.test.ts`
- Test: `src/features/products/__tests__/slug.test.ts`

**Interfaces:**
- Produces: `ProductEditorValue`, `ProductFAQ`, `ProductImage`, `ProductUploadRecord`, `validateProductEditor(value)`, `validateProductFile(file)`, `validateProductImages(files, occupiedSlots)`, `slugifyProductName(name)`, `uniqueProductSlug(base, existing)`, `formatTHB(cents)`, `formatBytes(bytes)`, and `discountPercent(price, comparePrice)`.

- [ ] **Step 1: Install the test and editor dependencies**

Run:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-youtube isomorphic-dompurify
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` and `package-lock.json` contain the listed dependencies without changing Next.js or React versions.

- [ ] **Step 2: Add failing domain tests**

Test exact cases:

```ts
expect(validateProductEditor(validValue)).toEqual({})
expect(validateProductEditor({ ...validValue, name: "" }).name).toBe("กรุณากรอกชื่อสินค้า")
expect(validateProductEditor({ ...validValue, comparePrice: "99", price: "199" }).comparePrice)
  .toBe("ราคาเดิมต้องมากกว่าราคาขาย")
expect(validateProductFile(new File([new Uint8Array(500 * 1024 * 1024 + 1)], "large.zip")))
  .toBe("ไฟล์ต้องมีขนาดไม่เกิน 500 MB")
expect(validateProductImages([new File(["x"], "x.gif", { type: "image/gif" })], 0)[0])
  .toMatchObject({ fileName: "x.gif", message: "รองรับเฉพาะ JPG, PNG และ WebP" })
expect(slugifyProductName("E-Book เสริมรายได้ 2026")).toBe("e-book-2026")
expect(uniqueProductSlug("e-book", ["e-book", "e-book-2"])).toBe("e-book-3")
expect(discountPercent(38900, 54900)).toBe(29)
```

- [ ] **Step 3: Run tests and verify the missing modules fail**

Run:

```bash
npx vitest run src/features/products/__tests__/validation.test.ts src/features/products/__tests__/slug.test.ts
```

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 4: Implement the product contracts and pure helpers**

Use explicit types:

```ts
export type ProductFAQ = { id: string; question: string; answer: string }
export type ProductImage = { id: string; path: string; publicUrl: string; alt: string }
export type ProductEditorValue = {
  name: string
  price: string
  comparePrice: string
  category: string
  descriptionHtml: string
  productFile: ProductUploadRecord | null
  images: ProductImage[]
  highlights: string[]
  faq: ProductFAQ[]
  published: boolean
}
export type ProductFieldErrors = Partial<Record<"name" | "price" | "comparePrice" | "productFile", string>>
```

Validation constants are `500 * 1024 * 1024`, `5 * 1024 * 1024`, five images, and 5,000 visible characters.

- [ ] **Step 5: Add the Vitest configuration and scripts**

Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

Configure jsdom, `@/` alias, React plugin, and `src/test/setup.ts`.

- [ ] **Step 6: Run the domain test cycle**

Run:

```bash
npm test -- src/features/products/__tests__/validation.test.ts src/features/products/__tests__/slug.test.ts
npm run typecheck
```

Expected: both test files pass and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test src/features/products
git commit -m "test: add product domain contracts"
```

---

### Task 2: Additive Database and Storage Migration

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: `ProductEditorValue` persistence fields from Task 1.
- Produces: product columns `slug`, `description_html`, `file_path`, `file_name`, `file_size`, `file_mime_type`, `images_v2`, `updated_at`; order columns `buyer_name`, `payment_method`, `mock`; private `product-files` bucket; public `product-images` bucket.

- [ ] **Step 1: Write migration assertions before SQL changes**

Run:

```bash
rg -n "products_shop_slug_unique|product-files|product-images|description_html|images_v2|payment_method" supabase/schema.sql
```

Expected: no matches.

- [ ] **Step 2: Add compatible columns and constraints**

Add idempotent SQL:

```sql
alter table products add column if not exists slug text;
alter table products add column if not exists description_html text;
alter table products add column if not exists file_path text;
alter table products add column if not exists file_name text;
alter table products add column if not exists file_size bigint;
alter table products add column if not exists file_mime_type text;
alter table products add column if not exists images_v2 jsonb not null default '[]';
alter table products add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_shop_slug_unique
  on products (shop_id, slug) where slug is not null;

alter table orders add column if not exists buyer_name text;
alter table orders add column if not exists payment_method text
  check (payment_method in ('promptpay', 'card'));
alter table orders add column if not exists mock boolean not null default true;
```

Backfill `slug` with a stable lowercase `product-<short id>` form only when null so existing rows become routable without renaming later.

- [ ] **Step 3: Add separate storage buckets and ownership policies**

Create `product-images` with `public = true` and `product-files` with `public = false`. Select on product files is owner-only; insert/update/delete requires the first path segment to equal `auth.uid()`. Public image select is unrestricted while writes remain owner-scoped.

- [ ] **Step 4: Verify SQL structure**

Run:

```bash
rg -n "products_shop_slug_unique|product-files|product-images|description_html|images_v2|payment_method" supabase/schema.sql
git diff --check -- supabase/schema.sql
```

Expected: every required identifier is present and no whitespace errors are reported.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: extend product storage schema"
```

---

### Task 3: Progress-Aware Upload Transport and Task State

**Files:**
- Modify: `src/lib/supabase/upload.ts`
- Create: `src/features/products/upload-task.ts`
- Test: `src/features/products/__tests__/upload-task.test.ts`

**Interfaces:**
- Consumes: file constraints from Task 1 and authenticated Supabase session.
- Produces:

```ts
type UploadDestination = "product-file" | "product-image"
type UploadResult = { path: string; publicUrl: string | null }
type UploadRequest = {
  userId: string
  file: File
  destination: UploadDestination
  signal: AbortSignal
  onProgress: (percent: number, sentBytes: number, totalBytes: number) => void
}
function uploadShopAsset(request: UploadRequest): Promise<UploadResult>
function deleteShopAsset(destination: UploadDestination, path: string): Promise<void>
```

- [ ] **Step 1: Write failing upload-task reducer tests**

Cover:

```ts
expect(uploadTaskReducer(initial, { type: "START" }).status).toBe("uploading")
expect(uploadTaskReducer(uploading, { type: "PROGRESS", percent: 42, sentBytes: 420 }).percent).toBe(42)
expect(uploadTaskReducer(uploading, { type: "SUCCESS", result }).status).toBe("success")
expect(uploadTaskReducer(uploading, { type: "FAIL", message: "เครือข่ายขัดข้อง" }).status).toBe("error")
expect(uploadTaskReducer(uploading, { type: "CANCEL" }).status).toBe("canceled")
expect(uploadTaskReducer(error, { type: "RETRY" }).status).toBe("queued")
```

- [ ] **Step 2: Run the reducer test and verify failure**

Run:

```bash
npm test -- src/features/products/__tests__/upload-task.test.ts
```

Expected: FAIL because `upload-task.ts` does not exist.

- [ ] **Step 3: Implement upload task state**

Use a discriminated status union:

```ts
type UploadStatus = "queued" | "uploading" | "success" | "error" | "canceled"
```

Clamp percent to `0..100`, keep the original `File` for retry, and preserve successful sibling tasks.

- [ ] **Step 4: Implement the byte-progress upload transport**

Use `XMLHttpRequest.upload.onprogress`, an authenticated Supabase bearer token, `AbortSignal`, and storage object endpoints. Set `x-upsert: false`, encode the path segments, and map status codes to actionable Thai errors. Product files target `product-files`; images target `product-images`. Return a public URL only for images.

- [ ] **Step 5: Run reducer, lint, and type checks**

Run:

```bash
npm test -- src/features/products/__tests__/upload-task.test.ts
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/upload.ts src/features/products/upload-task.ts src/features/products/__tests__/upload-task.test.ts
git commit -m "feat: add upload progress tasks"
```

---

### Task 4: Shared Product Editor and Create/Edit Routes

**Files:**
- Create: `src/features/products/components/ProductEditor.tsx`
- Create: `src/features/products/components/RichTextEditor.tsx`
- Create: `src/features/products/components/ProductFileUploader.tsx`
- Create: `src/features/products/components/ProductImageUploader.tsx`
- Create: `src/features/products/components/RepeatableFields.tsx`
- Test: `src/features/products/components/__tests__/ProductEditor.test.tsx`
- Modify: `src/app/dashboard/products/new/page.tsx`
- Create: `src/app/dashboard/products/[id]/edit/page.tsx`
- Delete: `src/app/dashboard/products/new/ProductNewForm.tsx`

**Interfaces:**
- Consumes: Task 1 domain model and Task 3 upload APIs.
- Produces:

```ts
type ProductEditorProps = {
  mode: "create" | "edit"
  shopId: string
  userId: string
  existingSlugs: string[]
  initialValue: ProductEditorValue
  productId?: string
}
```

- [ ] **Step 1: Write failing editor integration tests**

Test visible behavior:

```ts
expect(screen.getByRole("heading", { name: "สร้างสินค้าใหม่" })).toBeInTheDocument()
expect(screen.queryByText("AI Builder")).not.toBeInTheDocument()
expect(screen.getByRole("button", { name: "สร้างสินค้า" })).toBeDisabled()
await user.upload(screen.getByLabelText("เลือกไฟล์สินค้า"), validZip)
expect(screen.getByRole("progressbar", { name: "กำลังอัปโหลดไฟล์สินค้า" })).toHaveAttribute("aria-valuenow", "42")
expect(screen.getByText("เครือข่ายขัดข้อง")).toBeInTheDocument()
await user.click(screen.getByRole("button", { name: "ลองใหม่" }))
```

Also verify five-image enforcement, independent image progress, removing an image, moving an image to the first slot, compare-price validation, failed-save preservation, and edit-mode labels.

- [ ] **Step 2: Run editor tests and verify failure**

Run:

```bash
npm test -- src/features/products/components/__tests__/ProductEditor.test.tsx
```

Expected: FAIL because the editor components do not exist.

- [ ] **Step 3: Build the rich-text and repeatable field units**

Tiptap toolbar order mirrors the reference: bold, italic, strikethrough, H2, H3, unordered list, ordered list, blockquote, divider, link, video. Count visible text using `editor.getText().length`; reject updates beyond 5,000 characters and sanitize HTML before persistence.

- [ ] **Step 4: Build the file upload card**

Match the reference's title, supporting copy, large dashed drop zone, upload icon, “ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก”, and 500 MB hint. During upload replace the empty drop zone content with file metadata, percentage, progress bar, and cancel action. Success shows replace/remove; error shows retry/remove.

- [ ] **Step 5: Build the image upload grid**

Match the reference's 0/5 counter, 1200×1200 recommendation, thumbnail guidance, and square dashed add tile. Render local object URLs immediately, revoke them on removal/unmount, upload concurrently, and provide explicit “ใช้เป็นรูปแรก”, move-left/right, retry, and remove controls.

- [ ] **Step 6: Build the shared editor save flow**

Create payload:

```ts
{
  shop_id: shopId,
  slug,
  name,
  description: visibleText,
  description_html: sanitizedHtml,
  category,
  price_cents,
  compare_price_cents,
  highlights,
  faq,
  images: publicUrls,
  images_v2: orderedImages,
  file_path,
  file_name,
  file_size,
  file_mime_type,
  published
}
```

Create inserts; edit updates only the authorized product id and shop id. Handle Supabase errors before navigation. Add `beforeunload` protection while dirty or uploading.

- [ ] **Step 7: Wire create and edit server routes**

Both routes authenticate, load the owner's shop, and pass serializable editor props. Edit additionally fetches a product by `id` and `shop_id`; call `notFound()` on mismatch. Use `params: Promise<{ id: string }>` per the bundled Next.js 16 route guide.

- [ ] **Step 8: Run the editor test cycle**

Run:

```bash
npm test -- src/features/products/components/__tests__/ProductEditor.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/features/products/components src/app/dashboard/products
git commit -m "feat: build PIXZA-style product editor"
```

---

### Task 5: Merchant Product List and Responsive Navigation

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/products/page.tsx`
- Modify: `src/app/dashboard/products/ProductRow.tsx`
- Create: `src/app/dashboard/products/ProductActions.tsx`

**Interfaces:**
- Consumes: `slug`, `images_v2`, legacy `images`, and edit route from earlier tasks.
- Produces: preview, edit, publish/unpublish, and confirmed-delete flows.

- [ ] **Step 1: Capture a failing structural expectation**

Add a focused component test or server-render assertion using product id `product-123`, shop slug `demo-shop`, and product slug `demo-product`. Verify the row includes its thumbnail, edit link `/dashboard/products/product-123/edit`, preview link `/demo-shop/demo-product`, publication button, and delete button.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- src/app/dashboard/products/ProductRow.test.tsx
```

Expected: FAIL because the row lacks preview/edit controls and thumbnail.

- [ ] **Step 3: Reshape navigation to the reference**

Use the visual order หน้าแรก, สินค้า, จอง, ออเดอร์, สถิติ, ตั้งค่า. Remove AI-related concepts. Desktop uses a side rail; mobile uses a fixed bottom navigation with icons and active-state underline. Add bottom padding to page content so the bar never covers actions.

- [ ] **Step 4: Rebuild the product list and product row**

Match the reference's heading/action arrangement, product count, border rhythm, thumbnail size, metadata hierarchy, status treatment, and responsive stacking. Keep the existing free-plan count without blocking existing products.

- [ ] **Step 5: Add safe mutations**

`ProductActions` shows a confirmation dialog before delete, preserves the row on failure, shows a Thai error, and disables duplicate mutations. Publication updates include both product id and shop id.

- [ ] **Step 6: Run verification**

Run:

```bash
npm test -- src/app/dashboard/products/ProductRow.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/products
git commit -m "feat: match product management layout"
```

---

### Task 6: Storefront Product Grid

**Files:**
- Create: `src/features/storefront/ProductCard.tsx`
- Create: `src/features/storefront/ProductCard.test.tsx`
- Modify: `src/app/[slug]/page.tsx`
- Create: `src/app/[slug]/loading.tsx`

**Interfaces:**
- Consumes: shop and product public fields, new product slug, ordered/legacy images.
- Produces: card link `/${shopSlug}/${productSlug}`.

- [ ] **Step 1: Write failing ProductCard tests**

Verify one card-level link, square image, category badge, name, Thai sale price, optional compare price, fallback placeholder, and accessible name containing the product name.

- [ ] **Step 2: Run the card test and verify failure**

Run:

```bash
npm test -- src/features/storefront/ProductCard.test.tsx
```

Expected: FAIL because `ProductCard` does not exist.

- [ ] **Step 3: Implement the product card**

Use a 1:1 media area with an overlaid category badge, two-line title clamp, bold sale price, muted struck-through compare price, rounded image corners, and one outer `Link`. Use the first `images_v2` image, then legacy `images[0]`, then a branded placeholder.

- [ ] **Step 4: Recompose the storefront**

Match PIXZA's cover, overlapping avatar, share alignment, shop information, section rule, “สินค้าดิจิทัล” label, zero-padded count, two-column desktop grid, and single-column narrow grid. Keep service rendering below products under its own section.

- [ ] **Step 5: Add a proportional loading shell**

Reserve cover, avatar, profile text, and card grid geometry to avoid layout shift.

- [ ] **Step 6: Run card and static checks**

Run:

```bash
npm test -- src/features/storefront/ProductCard.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/storefront src/app/'[slug]'/page.tsx src/app/'[slug]'/loading.tsx
git commit -m "feat: rebuild storefront product grid"
```

---

### Task 7: Product Detail, Gallery, and Mock Checkout

**Files:**
- Create: `src/features/storefront/ProductGallery.tsx`
- Create: `src/features/storefront/MockCheckout.tsx`
- Test: `src/features/storefront/__tests__/MockCheckout.test.tsx`
- Create: `src/app/[slug]/[productSlug]/page.tsx`
- Create: `src/app/[slug]/[productSlug]/ProductPurchase.tsx`
- Create: `src/app/[slug]/[productSlug]/loading.tsx`
- Create: `src/app/[slug]/[productSlug]/not-found.tsx`
- Delete: `src/app/[slug]/BuyButton.tsx`

**Interfaces:**
- Consumes: public product detail fields and `orders` mock columns.
- Produces:

```ts
type MockCheckoutValue = {
  buyerName: string
  buyerEmail: string
  paymentMethod: "promptpay" | "card"
}
```

- [ ] **Step 1: Write failing checkout tests**

Using a fixture price of 38900 cents, verify the dialog opens from “ซื้อเลย ฿389”, states no real payment occurs, requires buyer name and valid email, permits PromptPay/card selection, prevents duplicate submission, inserts an order with `mock: true`, renders a success state, closes on Escape, and restores focus.

- [ ] **Step 2: Run checkout tests and verify failure**

Run:

```bash
npm test -- src/features/storefront/__tests__/MockCheckout.test.tsx
```

Expected: FAIL because checkout components do not exist.

- [ ] **Step 3: Build the gallery and detail route**

Fetch shop by `slug`, then product by `shop_id`, `productSlug`, and `published = true`. Await both dynamic params per Next.js 16. Render `notFound()` for missing or mismatched rows. Gallery uses the ordered image list and keyboard-accessible thumbnail buttons.

- [ ] **Step 4: Match the reference sales-page composition**

Render back-to-shop over the hero, square primary image, category badge, heading, sale/compare prices, calculated discount badge, full-width CTA, PromptPay/card and seven-day support copy, sanitized rich description, highlights, FAQ, and merchant footer. Do not render permanent file URLs.

- [ ] **Step 5: Build accessible mock checkout**

Insert:

```ts
{
  shop_id: shopId,
  product_id: productId,
  buyer_name: buyerName.trim(),
  buyer_email: buyerEmail.trim().toLowerCase(),
  payment_method: paymentMethod,
  price_cents: priceCents,
  status: "paid",
  mock: true
}
```

Label the flow “ทดลอง — ไม่มีการตัดเงินจริง”. On Supabase failure, remain in the dialog and display a Thai error.

- [ ] **Step 6: Add metadata and route states**

Generate title and description from the product and shop. Loading and not-found screens preserve the centered narrow-page geometry and provide a back-to-shop link.

- [ ] **Step 7: Run detail and checkout verification**

Run:

```bash
npm test -- src/features/storefront/__tests__/MockCheckout.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/storefront src/app/'[slug]'
git commit -m "feat: add product detail and mock checkout"
```

---

### Task 8: Visual System and Responsive Parity Pass

**Files:**
- Modify: `src/app/globals.css`
- Modify: product/editor/storefront component files identified by rendered comparison.

**Interfaces:**
- Consumes: completed product surfaces from Tasks 4–7.
- Produces: shared parity tokens and verified desktop/mobile layouts.

- [ ] **Step 1: Record reference checkpoints**

Use the authenticated PIXZA pages and public sample pages to record:

- Main content widths.
- Cover and square card ratios.
- Horizontal/vertical gaps.
- Border radii and line colors.
- Heading/body/metadata hierarchy.
- Desktop side navigation and mobile bottom navigation.
- Button order and alignment.

Do not copy merchant assets or text.

- [ ] **Step 2: Start EasySell and capture the same checkpoints**

Run:

```bash
npm run dev
```

Inspect `/dashboard/products`, `/dashboard/products/new`, one populated edit route, one populated shop storefront, and one populated product-detail page at desktop and mobile widths. Copy the actual shop and product slugs from the local database rather than guessing paths.

- [ ] **Step 3: Tune shared tokens**

Add focused CSS for:

- Rich-text prose spacing and embeds.
- Progress track/fill transitions and reduced motion.
- Visible `:focus-visible` outlines.
- Dialog backdrop and mobile sheet behavior.
- Mobile safe-area padding.
- Line clamps and square aspect-ratio media.

- [ ] **Step 4: Correct component-level mismatches**

Adjust only measured differences in width, alignment, spacing, type scale, button placement, and responsive stacking. Preserve EasySell colors and identity.

- [ ] **Step 5: Verify interaction states visually**

Inspect empty, uploading at partial progress, upload error, upload success, validation error, populated list, storefront fallback image, detail not-found, checkout validation, and checkout success.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/dashboard src/app/'[slug]' src/features/products src/features/storefront
git commit -m "style: complete PIXZA product parity pass"
```

---

### Task 9: Full Regression and Completion Audit

**Files:**
- Modify only files required by failures discovered in this task.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified phase-one product workflow and an evidence-backed completion report.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit 0. Fix root causes and rerun any failed command from the start.

- [ ] **Step 2: Verify create and edit manually**

Create a product with a valid 500 MB-or-smaller file, three images, formatted description, highlights, and FAQ. Confirm real progress bars, correct thumbnail ordering, successful persistence, edit hydration, replacement, removal, and unsaved-change warning.

- [ ] **Step 3: Verify upload failures manually**

Reject a file over 500 MB, a GIF, a sixth image, and an image over 5 MB before upload. Interrupt one image upload and confirm siblings survive. Retry an injected network failure and confirm the same file succeeds without clearing form content.

- [ ] **Step 4: Verify public flow manually**

Confirm the new card appears on the shop, the whole card navigates to the detail route, every price/category/image/detail field renders correctly, gallery controls work with keyboard and touch, and back-to-shop returns to the storefront.

- [ ] **Step 5: Verify mock checkout manually**

Confirm invalid buyer data is blocked, both mock payment methods are selectable, the disclosure is visible, one submit creates one mock order, no external payment page opens, and no permanent private-file URL appears.

- [ ] **Step 6: Audit every acceptance criterion**

For each acceptance criterion in `docs/superpowers/specs/2026-07-25-pixza-product-parity-design.md`, record the test, command output, rendered screen, database row, or storage policy that proves it. Treat missing evidence as incomplete and fix it before completion.

- [ ] **Step 7: Commit any regression fixes**

```bash
git add src supabase/schema.sql package.json package-lock.json vitest.config.ts
git commit -m "fix: close product parity regressions"
```

Skip this commit only when Step 1–6 require no code changes.
