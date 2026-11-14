# Design

<!-- impeccable:design-schema 1 -->

A Fastwork-derived system. The tokens below were read from **fastwork.com's own
computed styles on 2026-11-14**, then adapted for Thai text and for WCAG AA.
This replaced the previous indigo-on-white world; the old look is evidence, not
a reference. Source of truth: `src/app/globals.css`.

**What was taken:** the colour roles, the radius scale (pill controls), the type
scale and medium heading weight, control heights, the layered shadow steps, the
grey-body/white-card relationship, the floating dark navbar pill and the dark
band with page-radius corners. **What was not:** their wordmark, logo, imagery,
copy, icons or page content. "Google Sans" is Google-proprietary and is not used.

## Modes by surface

| Surface | Mode | What it owes the visitor |
|---|---|---|
| `/` landing | Persuade | A seller decides to open a shop. Claims must be true. |
| `/[slug]`, `/[slug]/[productSlug]`, checkout | Persuade | A buyer decides and pays. |
| `/dashboard/*`, `/learn/*` | Operate | Scanability over expression. |
| `/terms`, `/privacy` | Read | Comprehension. |

## Color

The body is grey and cards are white, so a card reads as a card. Nothing outside
`globals.css` invents a hex.

| Token | Value | Fastwork origin / note |
|---|---|---|
| `--background` | `#f5f5f5` | `--color-background-body` |
| `--paper` | `#ffffff` | `--color-background-card` |
| `--paper-dim` | `#f1f1f1` | `--color-accent-muted`, used for inset wells |
| `--ground-dark` | `#131922` | their dark marketing bands |
| `--ink` | `#171717` | `--color-text-primary` |
| `--ink-soft` | `#404040` | |
| `--muted` | `#6e6e6e` | **theirs is `#737373` = 4.35:1 on `#f5f5f5`, under AA.** `#6e6e6e` is 4.51:1 on the tightest ground |
| `--line` / `--line-strong` | `#ebebeb` / `#d4d4d4` | `--color-border` / `--color-border-emphasized` |
| `--accent` | `#0074e2` | `--color-fastwork`. **Fills only** — white on it is 4.57:1 |
| `--accent-text` | `#006cd2` | accent **as text**: `#0074e2` is only 4.19:1 on the grey ground |
| `--accent-hover` | `#0063c2` | |
| `--accent-soft` | `#e6f1fc` | |
| `--on-ink` / `--on-ink-soft` | `#ffffff` / `#a3a3a3` | `--color-icon-secondary` |
| `--success` / `--error` / `--warning` | `#198100` / `#e33f4a` / `#ffce2f` | taken verbatim |

Dark mode is **not built**. The roles are named so it can be added later, but no
dark values ship and nothing may assume them.

## Radius

`--radius-inner: 6px`, `--radius-element: 12px`, `--radius-container: 16px`,
`--radius-page: 42px`, plus `rounded-full`.

**Every control is a pill.** Buttons, chips, the navbar, the account menu trigger,
checkout options — all `rounded-full`. This is the loudest signal of the system,
so a square button is a mistake, not a variant. Cards take `--radius-container`,
controls inside them `--radius-element`, and the dark band `--radius-page`.

## Type

Noto Sans Thai, weights 400/500/600/700 — Google's own face, the closest free
match to Google Sans with Thai coverage.

**Headings are weight 500, not bold**, with tracking −0.025em on `h1`, −0.02em on
`h2`, −0.01em on `h3`. Fastwork's scale is a 1.19 ratio: 11 / 13 / 16 / 19 / 23 /
28 / 33 / 40 / 48px. Body is 16px at 1.5.

**`text-wrap: balance` is banned.** Thai has no spaces and balancing breaks inside
words — `ครีเอเตอร์` splits into `ครี` / `เอเตอร์`. `text-wrap: pretty` keeps the
browser's Thai segmentation and still avoids orphans. Uppercase and wide
letter-spacing are never applied to Thai strings; they do nothing but loosen them.

## Elevation and state

Four steps, each with two offsets, after their `--shadow-low/med/high`:
`--lift-1` … `--lift-4`, as `shadow-lift-1` … `shadow-lift-4`. Tailwind's
`shadow-sm/md/lg/xl/2xl` are not used in `src/`.

State is carried by an **inset ring**, not by resizing the box:
`--ring-hover`, `--ring-selected`, `--ring-error`. A focused input gains an inset
1px accent ring; a selected checkout option gains a 2px one.

## Control heights

`--h-xs` 28, `--h-sm` 36, `--h-md` 40, `--h-lg` 48, `--h-xl` 56 — their
`--size-element-*`. Inputs and small buttons are 36–40; primary buttons 44–48.

## Motion

`--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`; `--tap` 120ms, `--quick` 200ms,
`--settle` 420ms, `--enter` 760ms.

One authored entrance per page (`data-enter`), inside
`prefers-reduced-motion: no-preference`, with content visible by default so a
blocked script never hides it. Buttons press (`active:scale`), linked cards lift,
photos zoom to 1.03 inside `.zoom-frame`, links draw their underline.

## Icons

`src/components/icons.tsx` is the only icon source: 24×24, 1.75 stroke, round
caps, `currentColor`, `aria-hidden` unless given a `title`. No unicode glyph or
emoji stands in for an icon. Arrows inside running prose are text, not icons.

## The landing page

`/` is a light marketing page on the same tokens as the app: a sticky white
header, a split hero with the photograph bleeding off the right edge, a
four-up grid of what a seller can list, a dark band carrying the three steps, a
proof band, a testimonial carousel, pricing, FAQ and a closing call to action.
Accent is the system's own `#0074e2` — the reference design used orange and the
user asked for it not to be.

Full-bleed columns are built as real grid columns. A negative-margin bleed
(`calc((100% - 100vw) / 2)`) resolves its percentage against the column, not the
page shell, and pushed the layout 236px past the viewport. Connector arrows sit
as flex items between steps; positioning them absolutely without a positioned
ancestor put them at x=1460 and x=1656, off-page.

A gradient band (`rounded-page`, light blue → lilac → pink) carries the
payment-link story as a three-up grid: each of the example shop's real products
with its real `buykub.com` URL in a mono field and its own working copy button,
over a link to the live shop. Nothing in it mocks up a feature that does not exist.

### Testimonials ship as labelled placeholders

`Testimonials.tsx` carries twenty invented sellers — half in Thai script, half
romanised — so the section can be designed at full fidelity. They run as one
continuously scrolling row (`.marquee`): the track holds the list twice and
travels exactly -50%, so the loop has no seam, the duplicate lane is
`aria-hidden`, and hover or keyboard focus pauses it. Under
`prefers-reduced-motion: reduce` the animation is dropped entirely and the row
becomes an ordinary horizontal scroller — the global reduce rule only shortens
durations, which would have parked the marquee on its last frame. **They are marked on the page** — "ข้อความตัวอย่างสำหรับจัดหน้า ·
ยังไม่ใช่รีวิวจากผู้ขายจริง" — because BUYKUB has no customers to quote: the catalog
was reset on 2026-11-13 and no paid live order has settled. Presenting an
invented review as genuine deceives buyers and is unlawful in the markets this
site serves, so the label is not decoration: `LandingCopy.test.tsx` fails if it
is removed while the placeholder data is still in place. Supply real,
permissioned quotes and pass `placeholder={false}` to drop it.

Photographs are free-licence Unsplash, credited in
`public/images/landing/credits.json` and `docs/licenses/landing-panels.md`. One
candidate was rejected during sourcing because its page reported
`unsplash.com/plus/license`, which is not the free licence.

## Structure## Structure

- `.shell` (max-w-6xl), `.section` (px-6, py-20/24), `.card`, `.dark-band`.
- **The navbar is a dark pill floating clear of the page edge**, not a bar stuck
  to the top.
- Exactly one dark band per page (`WhyUs` on the landing), carrying the page radius.
- Headings carry their own weight: **no kicker or eyebrow above a heading, anywhere.**
- No grid of same-size icon + heading + text cards, and no hero metric row.
- Product cards are white cards with the thumbnail *inside* them, after their
  service cards: thumbnail, title, then price last.

## Copy

Plain Thai, seller to seller. The landing may not state a shop count, a revenue
total, a testimonial or a payout schedule — `src/components/__tests__/LandingCopy.test.tsx`
fails the build if any returns. The payout line everywhere: a seven-day hold, then
a transfer staff make by hand with a slip. There is no automatic bank transfer.

`src/app/brand-assets.test.ts` holds the palette to AA on all three light grounds
and rebuilds the favicon check from `icon.svg`.
