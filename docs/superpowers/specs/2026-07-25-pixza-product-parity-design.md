# PIXZA Product Experience Parity Design

## Objective

Build the first phase of EasySell's PIXZA-parity experience: a complete digital-product workflow from product authoring through storefront discovery, product detail, and a mock checkout. EasySell keeps its existing name, identity, and merchant data, while PIXZA is the baseline for page structure, component placement, interaction patterns, responsive behavior, and visual density.

AI Builder is explicitly excluded. Payment processing is a functional mockup and must not charge a customer, send money, or initiate a real payout.

## Phase Boundary

This specification covers:

- Product list and product-management states.
- Create and edit product flows.
- Rich-text product descriptions.
- Product-file and image uploads with real byte progress.
- Storefront product cards.
- A dedicated product-detail route.
- A mock checkout that can create a mock order.
- Desktop and mobile parity checks against the corresponding PIXZA surfaces.

Later specifications will cover booking management, full order management, analytics, settings, real payments, transactional email, refunds, and payouts. Existing routes in those areas must continue to work, but visual parity for them is outside this phase.

## Reference and Branding Rules

- PIXZA's current public storefront, product-detail page, product list, and product create/edit screens are the visual and interaction reference.
- Preserve EasySell's brand name and existing brand identity. Do not copy PIXZA logos, merchant content, product media, or proprietary marketing copy.
- Match the reference's information hierarchy, content width, alignment, spacing rhythm, card proportions, button placement, responsive navigation, and interaction states as closely as the existing stack permits.
- Remove every AI Builder entry point, banner, navigation item, allowance badge, and related empty state.
- Thai is the primary interface language.

## Information Architecture

### Merchant Routes

- `/dashboard/products` is the product-management index.
- `/dashboard/products/new` creates a product.
- `/dashboard/products/[id]/edit` edits an existing product.
- The create and edit routes share one product-editor component and validation model.

### Public Routes

- `/[slug]` is the shop storefront.
- `/[slug]/[productSlug]` is the dedicated product-detail page.
- Every product card is one accessible link to its detail page.
- The detail page links back to the owning storefront.

## Product Data Model

Products retain their current fields and add the following durable data:

- `slug`: a shop-scoped, URL-safe product slug.
- `description_html`: sanitized rich-text output.
- `file_path`: a private storage path rather than a public download URL.
- `file_name`: the original display name.
- `file_size`: byte size.
- `file_mime_type`: detected MIME type where available.
- Ordered image records or an ordered image array that preserves gallery order.

The first image is always the storefront thumbnail. Product slugs must be unique within a shop, remain stable after product-name edits, and receive a deterministic numeric suffix on collision.

Existing `description`, `file_url`, and `images` data must remain readable during migration. New writes use the new fields, and compatibility reads prevent old products from disappearing.

## Merchant Product List

The product index follows PIXZA's structure after removing AI Builder:

- Page title, product count/plan allowance, and primary create-product action.
- Product rows or cards showing thumbnail, name, category, price, publication state, and management actions.
- Clear empty state with a create-product action.
- Actions for edit, publish/unpublish, storefront preview, and delete.
- Delete requires confirmation and must not silently remove storage objects if the database operation fails.
- Mobile layout uses the same bottom navigation pattern and visual order as the reference.

## Product Editor

The editor follows the reference page order:

1. Breadcrumb and page title.
2. Product information.
3. Product file.
4. Product images.
5. Highlights.
6. FAQ.
7. Cancel and create/save actions.

AI assistance UI is omitted without leaving an empty placeholder.

### Product Information

- Required product name.
- Required non-negative price in Thai baht.
- Optional compare-at price, which must be greater than the sale price when supplied.
- One category selected from the existing category set.
- Rich-text description with headings, bold, italic, strikethrough, ordered and unordered lists, blockquote, divider, link, and supported video embed.
- Character count capped at 5,000 visible text characters.
- Stored HTML is sanitized before rendering publicly.

### Highlights and FAQ

- Highlights can be added, edited, reordered, and removed.
- FAQ entries contain a required question and answer and can be added, edited, reordered, and removed.
- Empty drafts are never persisted.

### Save Behavior

- Create requires valid core information and a successfully uploaded product file.
- Save is disabled while any upload is active.
- A failed save stays on the editor, preserves every field, and shows a specific error.
- Successful create navigates to the product index.
- Successful edit shows confirmation and refreshes the saved state without discarding the merchant's context.
- Navigation away with unsaved changes or active uploads triggers a warning.

## Upload Experience

### Product File

- Exactly one product file.
- Maximum size: 500 MB.
- Any file type is accepted.
- Supports drag-and-drop and native file selection.
- Files are stored in a private bucket.

### Product Images

- Up to five images.
- Accepted types: JPEG, PNG, and WebP.
- Maximum size: 5 MB per image.
- Supports drag-and-drop, native selection, and multiple selection.
- Images may upload concurrently.
- Images are reorderable; moving an image to the first position changes the thumbnail.

### Upload State

Every upload item exposes:

- File name and formatted size.
- Real progress derived from transmitted bytes.
- Percentage and a visible progress bar.
- Uploading, success, error, canceled, and retrying states.
- Cancel while uploading.
- Retry after a recoverable error.
- Remove or replace after success.

Image uploads additionally show a local preview before completion. Each image has independent progress and errors. A failed image must not block successful siblings or erase the rest of the form.

The uploader uses a transport that emits byte progress and supports cancellation. It must not buffer a 500 MB file in application memory. Orphaned uploads created by canceling or abandoning a product are cleaned up safely.

## Public Storefront

The shop page mirrors the reference layout:

- Full-width cover within the centered storefront shell.
- Overlapping shop avatar.
- Share action aligned with the profile header.
- Shop name and bio.
- A digital-products section with item count.
- Two-column desktop product grid and single-column mobile grid.
- Square thumbnail, category badge, product name, sale price, and optional struck-through compare price.
- Entire cards are keyboard-accessible links.
- Services continue to render without breaking, but product parity takes priority in this phase.

Missing images use an intentional branded placeholder. Images reserve their aspect ratio to avoid layout shift.

## Product Detail

The detail page follows the reference's narrow centered sales-page composition:

- Back-to-shop control over the hero area.
- Product gallery with the first image as the primary visual.
- Category badge.
- Product name.
- Sale price, compare price, and calculated discount percentage.
- Full-width primary purchase action.
- Mock payment-method and seven-day refund-support copy clearly marked as a demonstration where needed.
- Sanitized rich-text description.
- Highlights and FAQ sections when populated.
- Merchant identity and link back to all products.

The gallery supports multiple images without changing the reference's primary 1:1 presentation. Keyboard and touch users can change the active image.

## Mock Checkout

The purchase action opens a checkout dialog or sheet appropriate to the viewport:

- Product summary and final price.
- Buyer name and email fields.
- Mock payment-method selection for PromptPay or credit card.
- Explicit text stating that the flow is a demonstration and no payment will be charged.
- Required-field and email-format validation.
- Submit creates a mock order record only.
- Success state confirms the mock order and offers navigation back to the shop.
- No payment provider, financial transaction, payout, real refund, real delivery email, or unrestricted private-file download is invoked.

Private product files are represented by a short-lived signed-download mechanism in the architecture, but the mock checkout must not expose a permanent public URL. Whether the mock success screen exposes a signed test download is controlled by a development-safe flag and is off by default.

## Error, Empty, and Loading States

- Upload validation errors appear beside the relevant item.
- Database and network failures use actionable Thai messages.
- Product list, storefront, and detail routes have deliberate loading, empty, not-found, and retry states.
- Public routes never expose private storage paths or internal database errors.
- A missing, unpublished, or shop-mismatched product returns the product not-found experience.
- Duplicate submits are prevented.

## Accessibility and Responsive Behavior

- All controls have accessible names and visible focus states.
- Progress elements expose current percentage and status to assistive technology without excessive announcements.
- Dialog focus is trapped and restored to the purchase button on close.
- Pointer targets meet a minimum practical mobile size.
- Layout is verified at representative mobile and desktop widths.
- Mobile bottom navigation does not obscure form actions or public content.

## Architecture

Use focused units rather than adding more responsibility to the current route files:

- A product domain type and validation module.
- A reusable product editor.
- A product-file uploader and image-gallery uploader built on a shared upload-task abstraction.
- Storefront product-card and product-gallery components.
- A mock checkout component and mock-order persistence boundary.
- Server route components for data loading and authorization.

Server components load authenticated or public data. Client components own editor state, upload lifecycle, reordering, rich-text interaction, gallery interaction, and checkout interaction. Supabase remains the database, authentication, and storage provider.

## Verification

Automated verification covers:

- Validation and slug generation.
- Upload state transitions, progress, cancellation, retry, and partial image failures.
- Create and edit editor behavior.
- Product-card routing.
- Public product authorization and not-found behavior.
- Price and discount formatting.
- Mock checkout validation, duplicate-submit prevention, and mock-order creation.

Before delivery:

- Run lint and TypeScript validation.
- Run the production build.
- Run the relevant automated tests.
- Compare the product index, create/edit editor, storefront, product detail, and mock checkout against PIXZA on desktop and mobile.
- Check normal, empty, loading, uploading, success, validation-error, network-error, and not-found states.

## Acceptance Criteria

- Product files and images show real, item-specific upload progress.
- Uploads support cancellation and retry without losing form data.
- The product-file card and image area closely match PIXZA's structure and positioning.
- A merchant can create and edit a complete product with rich description, file, ordered images, highlights, and FAQ.
- Storefront product cards closely match the reference and navigate to a dedicated product-detail page.
- The product-detail page contains the complete sales information and responsive composition described above.
- The mock checkout is usable end to end and never charges money.
- EasySell branding remains intact and no AI Builder UI is present.
- Existing products and unrelated existing routes remain usable.
