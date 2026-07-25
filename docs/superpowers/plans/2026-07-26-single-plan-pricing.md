# Single-plan Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Framelink's Free/Pro/Pro+ subscription UI with one universal 5%-per-order offer and remove all obsolete upgrade paths.

**Architecture:** Keep commercial copy in the existing landing and dashboard surfaces, but remove all tier-selection state and components. Convert the old upgrade page to a server redirect so saved links remain safe while no subscription UI remains.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- No subscription plan or recurring membership fee.
- Fee is exactly 5% per order.
- Products and booking services are unlimited.
- No Framelink watermark.
- Payouts happen every Monday.
- `/dashboard/settings/upgrade` redirects to `/dashboard/settings`.
- Remove obsolete Free, Pro, and Pro+ UI and mock subscription checkout code.

---

### Task 1: Replace the landing pricing model

**Files:**
- Modify: `src/components/__tests__/LandingCopy.test.tsx`
- Modify: `src/components/Pricing.tsx`
- Modify: `src/components/FAQ.tsx`

**Interfaces:**
- Consumes: Existing `Pricing` and `FAQ` React components.
- Produces: A single-offer Pricing section and FAQ copy with no tier terminology.

- [ ] **Step 1: Write the failing landing test**

Add assertions for the exact five offer bullets, a single “เริ่มเปิดร้านฟรี” link, and the absence of `FREE`, `PRO`, `PRO+`, `8%`, `2%`, and `0%`:

```tsx
expect(screen.getByText("ค่าธรรมเนียม 5% ต่อออเดอร์")).toBeInTheDocument();
expect(screen.getByText("สินค้าไม่จำกัด")).toBeInTheDocument();
expect(screen.getByText("จองไม่จำกัด")).toBeInTheDocument();
expect(screen.getByText("ไม่มีลายน้ำ")).toBeInTheDocument();
expect(screen.getAllByText("โอนเงินทุกวันจันทร์").length).toBeGreaterThanOrEqual(2);
expect(screen.getByRole("link", { name: "เริ่มเปิดร้านฟรี" })).toHaveAttribute(
  "href",
  "/login?next=%2Fdashboard",
);
expect(screen.queryByText("FREE")).not.toBeInTheDocument();
expect(screen.queryByText("PRO")).not.toBeInTheDocument();
expect(screen.queryByText("PRO+")).not.toBeInTheDocument();
expect(screen.queryByText(/8%|2%|0%/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the landing test and verify RED**

Run: `npm test -- src/components/__tests__/LandingCopy.test.tsx`

Expected: FAIL because the current pricing renders three tiers and old fees.

- [ ] **Step 3: Implement the single offer**

Replace the `plans` array and three-column map with one centered card. Keep the section heading “เลือกแพลนที่ใช่”, use copy stating everyone receives all features without a membership plan, render the five exact benefits, and link the CTA to `/login?next=%2Fdashboard`.

Change the first FAQ answer to:

```ts
"Framelink คิดค่าธรรมเนียม 5% ต่อออเดอร์ที่ขายได้เท่านั้น ไม่มีค่าแรกเข้า ค่าสมาชิกรายเดือน หรือค่าธรรมเนียมแพลนซ่อนอยู่"
```

- [ ] **Step 4: Run the landing test and verify GREEN**

Run: `npm test -- src/components/__tests__/LandingCopy.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the landing change**

```bash
git add src/components/Pricing.tsx src/components/FAQ.tsx src/components/__tests__/LandingCopy.test.tsx
git commit -m "feat: replace pricing tiers with universal offer"
```

### Task 2: Remove plan UI from dashboard

**Files:**
- Create: `src/app/dashboard/DashboardLayoutContent.test.tsx`
- Create: `src/app/dashboard/DashboardLayoutContent.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/settings/CommercialTerms.test.tsx`
- Create: `src/app/dashboard/settings/CommercialTerms.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

**Interfaces:**
- Consumes: `DashboardNavigation`, `SignOutButton`, authenticated `user`, and optional `shop`.
- Produces: `DashboardLayoutContent({ children, user, shop })` for presentation and `CommercialTerms()` for universal terms.

- [ ] **Step 1: Write failing dashboard presentation tests**

Render the extracted dashboard shell and commercial terms. Assert the shell contains no upgrade link or Free badge, and terms show 5%, unlimited products/bookings, no watermark, and Monday payouts.

```tsx
expect(screen.queryByRole("link", { name: /อัปเกรด/ })).not.toBeInTheDocument();
expect(screen.queryByText("Free")).not.toBeInTheDocument();
expect(screen.getByText("ค่าธรรมเนียม 5% ต่อออเดอร์")).toBeInTheDocument();
expect(screen.getByText("สินค้าและบริการจองไม่จำกัด")).toBeInTheDocument();
expect(screen.getByText("ไม่มีลายน้ำ")).toBeInTheDocument();
expect(screen.getByText("โอนเงินทุกวันจันทร์")).toBeInTheDocument();
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `npm test -- src/app/dashboard/DashboardLayoutContent.test.tsx src/app/dashboard/settings/CommercialTerms.test.tsx`

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Extract and clean the dashboard shell**

Move the authenticated JSX from `layout.tsx` into `DashboardLayoutContent.tsx`, using minimal serializable `user` and `shop` props. Remove the Pro card and Free badge entirely. Keep shop identity, sign-out, desktop navigation, and mobile navigation unchanged.

- [ ] **Step 4: Replace the membership panel**

Create `CommercialTerms.tsx` as a compact settings card with the four universal terms. Replace the “การสมัครสมาชิก” section, upgrade CTA, and mock subscription note in `settings/page.tsx` with this component. Remove the now-unused `Link` import.

- [ ] **Step 5: Run dashboard tests and verify GREEN**

Run: `npm test -- src/app/dashboard/DashboardLayoutContent.test.tsx src/app/dashboard/settings/CommercialTerms.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit dashboard cleanup**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/DashboardLayoutContent.tsx src/app/dashboard/DashboardLayoutContent.test.tsx src/app/dashboard/settings/page.tsx src/app/dashboard/settings/CommercialTerms.tsx src/app/dashboard/settings/CommercialTerms.test.tsx
git commit -m "feat: remove subscription tiers from dashboard"
```

### Task 3: Retire the upgrade page

**Files:**
- Create: `src/app/dashboard/settings/upgrade/page.test.tsx`
- Modify: `src/app/dashboard/settings/upgrade/page.tsx`
- Delete: `src/app/dashboard/settings/upgrade/UpgradePlans.tsx`
- Delete: `src/app/dashboard/settings/upgrade/__tests__/UpgradePlans.test.tsx`

**Interfaces:**
- Consumes: Next.js `redirect`.
- Produces: A permanent in-app fallback that redirects old upgrade URLs to Settings.

- [ ] **Step 1: Write the failing redirect test**

Mock `next/navigation` and assert the page calls:

```ts
expect(redirect).toHaveBeenCalledWith("/dashboard/settings");
```

- [ ] **Step 2: Run the redirect test and verify RED**

Run: `npm test -- src/app/dashboard/settings/upgrade/page.test.tsx`

Expected: FAIL because the page currently renders upgrade plans.

- [ ] **Step 3: Implement redirect and delete obsolete code**

Replace the page with:

```tsx
import { redirect } from "next/navigation";

export default function UpgradePage() {
  redirect("/dashboard/settings");
}
```

Delete the tier cards, billing toggle, comparison table, modal checkout, and obsolete component test.

- [ ] **Step 4: Run the redirect test and verify GREEN**

Run: `npm test -- src/app/dashboard/settings/upgrade/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit route retirement**

```bash
git add -A src/app/dashboard/settings/upgrade
git commit -m "refactor: retire subscription upgrade page"
```

### Task 4: Audit and verify the single-plan system

**Files:**
- Modify only files implicated by audit failures.

**Interfaces:**
- Consumes: Completed landing, dashboard, and redirect tasks.
- Produces: Verified absence of obsolete commercial terms.

- [ ] **Step 1: Scan source for obsolete user-facing terms**

Run:

```bash
rg -n '"[^"]*(Free|Pro\\+?|8%|2%|0%|5 ชิ้น|watermark|อัปเกรด)[^"]*"' src --glob '*.{ts,tsx}'
```

Expected: No obsolete pricing or upgrade UI matches. Unrelated technical percentage output may remain only when it is not commercial copy.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/components/__tests__/LandingCopy.test.tsx src/app/dashboard/DashboardLayoutContent.test.tsx src/app/dashboard/settings/CommercialTerms.test.tsx src/app/dashboard/settings/upgrade/page.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: All commands exit 0.

- [ ] **Step 4: Commit audit fixes if any**

```bash
git add -A
git commit -m "test: verify universal pricing model"
```

