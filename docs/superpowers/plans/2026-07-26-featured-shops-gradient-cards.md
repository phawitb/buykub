# Featured Shops Gradient Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the six landing-page Featured shops cards with fast CSS-only gradient covers, overlapping avatars, and the hierarchy shown in the supplied reference.

**Architecture:** Extend the static shop data with theme tokens and a small CSS-only motif. Keep each card as one accessible Next.js link and render all decoration inside the existing `FeaturedShops` component without image assets or runtime requests.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- Do not add raster or remote image assets.
- Keep the six existing fictional demo shops and disclaimer copy.
- Use one, two, and three responsive grid columns.
- Preserve the login CTA route `/login?next=%2Fdashboard`.
- Decorative cover elements must be hidden from assistive technology.

---

### Task 1: Lock the card contract with tests

**Files:**
- Modify: `src/components/__tests__/FeaturedShops.test.tsx`

**Interfaces:**
- Consumes: `FeaturedShops`.
- Produces: regression coverage for six themed covers, six overlapping avatars,
  responsive grid structure, and CTA destinations.

- [ ] **Step 1: Write failing assertions**

Add stable `data-testid="featured-shop-grid"`,
`data-testid="shop-cover"`, and `data-testid="shop-avatar"` expectations:

```ts
expect(screen.getAllByTestId("shop-cover")).toHaveLength(6);
expect(screen.getAllByTestId("shop-avatar")).toHaveLength(6);
expect(screen.getByTestId("featured-shop-grid")).toHaveClass(
  "grid-cols-1",
  "sm:grid-cols-2",
  "lg:grid-cols-3",
);
for (const link of screen.getAllByRole("link", { name: /สร้างร้านแบบ/ })) {
  expect(link).toHaveAttribute("href", "/login?next=%2Fdashboard");
}
```

Assert each cover contains an `aria-hidden="true"` decorative motif and no
`img` element.

- [ ] **Step 2: Run tests and verify RED**

Run:
`npm test -- src/components/__tests__/FeaturedShops.test.tsx`

Expected: FAIL because cover/avatar test IDs do not exist.

- [ ] **Step 3: Commit the RED test only after implementation is ready**

Do not commit a deliberately failing branch; keep the test uncommitted until
Task 2 turns it green.

### Task 2: Build CSS-gradient cards

**Files:**
- Modify: `src/components/FeaturedShops.tsx`
- Modify: `src/components/__tests__/FeaturedShops.test.tsx`

**Interfaces:**
- Extends each shop item with `coverClass`, `motifClass`, and `avatarClass`.
- Produces: six equal-height linked cards with CSS-only visual covers.

- [ ] **Step 1: Extend shop theme data**

Give the six shops literal Tailwind gradient palettes:

```ts
[
  "from-emerald-950 via-emerald-700 to-lime-300",
  "from-stone-700 via-amber-100 to-orange-50",
  "from-slate-900 via-slate-500 to-stone-100",
  "from-blue-950 via-indigo-600 to-cyan-200",
  "from-zinc-950 via-neutral-700 to-amber-100",
  "from-violet-700 via-fuchsia-500 to-cyan-300",
]
```

Use complete literal class strings in source so Tailwind detects them.

- [ ] **Step 2: Implement the new hierarchy**

Render a `h-36 sm:h-40` cover with overflow hidden, two or three
`aria-hidden` blurred circles/lines for texture, and an avatar positioned with
negative top margin. Change article padding so the cover reaches card edges,
then put content in `flex flex-1 flex-col p-6 pt-0`. Use `mt-auto` for the CTA
so card bottoms align.

- [ ] **Step 3: Add restrained interaction**

Keep the existing focus outline, add card shadow/translate on hover, and apply
`group-hover:scale-105` only to decorative cover content with a transition.
Do not animate text or meaningful information.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
`npm test -- src/components/__tests__/FeaturedShops.test.tsx`

Expected: all cover, avatar, CTA, disclaimer, and six-card assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeaturedShops.tsx \
  src/components/__tests__/FeaturedShops.test.tsx
git commit -m "feat: redesign featured shop cards"
```

### Task 3: Visual and full-suite verification

**Files:**
- Modify only if verification exposes a defect:
  `src/components/FeaturedShops.tsx`

**Interfaces:**
- Produces: verified desktop, tablet, and mobile landing-page layouts.

- [ ] **Step 1: Inspect desktop layout**

Open `http://localhost:3011/`, verify a 3×2 grid, aligned card bottoms,
overlapping avatars, readable contrast, and no image requests from the
section.

- [ ] **Step 2: Inspect tablet and mobile layout**

Check approximately 768 px and 390 px viewports. Verify two and one columns,
no horizontal overflow, intact price alignment, and visible keyboard focus.

- [ ] **Step 3: Run full verification**

Run:
`npm test && npm run lint && npm run typecheck && npm run build && git diff --check`

Expected: zero test failures, zero lint/type errors, build exit 0, and no
whitespace errors.

- [ ] **Step 4: Commit verification fixes if needed**

```bash
git add src/components/FeaturedShops.tsx \
  src/components/__tests__/FeaturedShops.test.tsx
git commit -m "fix: polish featured shop responsiveness"
```

