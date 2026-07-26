# Featured Shops Gradient Cards

## Goal

Redesign the landing-page Featured shops section to resemble the supplied
six-card reference while keeping Framelink's existing visual identity and
avoiding additional image downloads.

## Layout

- Keep the existing eyebrow, heading, and explanatory copy.
- Present six equal-height cards in a responsive grid:
  - one column on mobile;
  - two columns on tablet;
  - three columns on desktop.
- Each card has a wide gradient cover, a circular avatar overlapping the cover
  edge, and a content area containing the shop name, demo URL, bio, product
  rows, prices, and the “สร้างร้านแบบนี้ →” call to action.

## Gradient Covers

- Use CSS gradients rather than raster image assets.
- Give each demo shop a distinct gradient palette matching its theme.
- Add subtle CSS-only decorative shapes or texture so the covers do not look
  like plain color blocks.
- Ensure decorative elements are ignored by assistive technology.
- Preserve readable contrast and avoid placing meaningful text inside covers.

## Interaction

- The entire card remains one accessible link to
  `/login?next=%2Fdashboard`.
- Keyboard focus uses the existing Framelink accent outline.
- Hover raises the card slightly and adds a restrained cover animation.
- Motion remains decorative and must not be required to understand the card.

## Data and Content

- Keep the six existing fictional demo shops and their products.
- Keep the explicit statement that names and information are demonstrations.
- Add a short visual label or icon motif per shop without implying that the
  shop is live.

## Testing

- Verify six cards render.
- Verify each card has a gradient cover and overlapping avatar.
- Verify every card is an accessible link to the expected login route.
- Verify all shop names and demo URLs remain present.
- Verify the responsive grid classes and CSS-only cover treatment.

