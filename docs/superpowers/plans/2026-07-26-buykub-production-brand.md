# BUYKUB Production Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace customer-facing FRAMELINK identity with BUYKUB and make `https://buykub.com/{shop-slug}` the canonical public shop URL.

**Architecture:** Add one server-safe immutable brand module for product identity, contact details, and canonical URL helpers. Reuse the existing `BrandLogo` component for the split-color wordmark, update all customer-facing consumers to use the shared contract, and keep equivalent deployment-safe constants inside the isolated Supabase Edge Function.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Supabase Edge Functions, Deno.

## Global Constraints

- Customer-facing wordmark is uppercase `BUYKUB`.
- `BUY` uses the primary ink color and `KUB` uses `#2563EB → #7C3AED`.
- Canonical production origin is `https://buykub.com`.
- Public support address is `support@buykub.com`.
- Public shop URLs remain `/{slug}` at the routing layer.
- Mock-payment disclosures remain visible.
- Secrets must not be committed.
- Read the relevant Next.js 16 documentation from `node_modules/next/dist/docs/` before changing metadata or deployment configuration.

---

### Task 1: Shared brand contract and canonical URLs

**Files:**
- Create: `src/lib/brand.ts`
- Create: `src/lib/brand.test.ts`

**Interfaces:**
- Produces: `BRAND_NAME`, `BRAND_ORIGIN`, `BRAND_DOMAIN`, `SUPPORT_EMAIL`, `ORDER_EMAIL`, `shopUrl(slug: string): string`, and `productUrl(shopSlug: string, productSlug: string): string`.
- Consumes: no application runtime dependencies.

- [ ] **Step 1: Write failing tests for immutable brand values and URL encoding**

```ts
import { describe, expect, it } from "vitest";
import {
  BRAND_DOMAIN,
  BRAND_NAME,
  BRAND_ORIGIN,
  ORDER_EMAIL,
  SUPPORT_EMAIL,
  productUrl,
  shopUrl,
} from "./brand";

describe("brand contract", () => {
  it("exposes BUYKUB production identity", () => {
    expect(BRAND_NAME).toBe("BUYKUB");
    expect(BRAND_DOMAIN).toBe("buykub.com");
    expect(BRAND_ORIGIN).toBe("https://buykub.com");
    expect(SUPPORT_EMAIL).toBe("support@buykub.com");
    expect(ORDER_EMAIL).toBe("orders@mail.buykub.com");
  });

  it("builds canonical encoded shop and product URLs", () => {
    expect(shopUrl("phawitboo")).toBe("https://buykub.com/phawitboo");
    expect(shopUrl("/ร้าน ไทย/")).toBe(
      "https://buykub.com/%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%20%E0%B9%84%E0%B8%97%E0%B8%A2",
    );
    expect(productUrl("phawitboo", "starter key")).toBe(
      "https://buykub.com/phawitboo/starter%20key",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/brand.test.ts`

Expected: FAIL because `src/lib/brand.ts` does not exist.

- [ ] **Step 3: Implement the minimal server-safe brand module**

```ts
export const BRAND_NAME = "BUYKUB";
export const BRAND_DOMAIN = "buykub.com";
export const BRAND_ORIGIN = `https://${BRAND_DOMAIN}`;
export const SUPPORT_EMAIL = "support@buykub.com";
export const ORDER_EMAIL = "orders@mail.buykub.com";

function pathSegment(value: string) {
  return encodeURIComponent(value.replace(/^\/+|\/+$/g, ""));
}

export function shopUrl(slug: string) {
  return `${BRAND_ORIGIN}/${pathSegment(slug)}`;
}

export function productUrl(shopSlug: string, productSlug: string) {
  return `${shopUrl(shopSlug)}/${pathSegment(productSlug)}`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/brand.test.ts`

Expected: 1 test file passed.

- [ ] **Step 5: Commit the shared contract**

```bash
git add src/lib/brand.ts src/lib/brand.test.ts
git commit -m "feat: add BUYKUB brand contract"
```

---

### Task 2: Accessible BUYKUB wordmark

**Files:**
- Modify: `src/components/BrandLogo.tsx`
- Modify: `src/components/BrandLogo.test.tsx`

**Interfaces:**
- Consumes: `BRAND_NAME` from `@/lib/brand`.
- Produces: the existing `BrandLogo({ className?: string })` API with accessible name `BUYKUB`.

- [ ] **Step 1: Change the component test to require the BUY/KUB split and exact gradient**

```tsx
it("renders the accessible BUYKUB split-color wordmark", () => {
  render(<BrandLogo />);

  const logo = screen.getByLabelText("BUYKUB");
  expect(logo).toHaveTextContent("BUYKUB");
  expect(screen.getByText("BUY")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("KUB")).toHaveClass(
    "from-[#2563EB]",
    "to-[#7C3AED]",
    "bg-clip-text",
    "text-transparent",
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/components/BrandLogo.test.tsx`

Expected: FAIL because the component still renders `FRAMELINK`.

- [ ] **Step 3: Implement the BUYKUB wordmark**

```tsx
import { BRAND_NAME } from "@/lib/brand";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label={BRAND_NAME}
      className={`inline-flex font-bold tracking-tight ${className}`}
    >
      <span aria-hidden>BUY</span>
      <span
        aria-hidden
        className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent"
      >
        KUB
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/components/BrandLogo.test.tsx`

Expected: 1 test file passed.

- [ ] **Step 5: Commit the wordmark**

```bash
git add src/components/BrandLogo.tsx src/components/BrandLogo.test.tsx
git commit -m "feat: rebrand wordmark as BUYKUB"
```

---

### Task 3: Customer-facing application identity and URLs

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/[slug]/page.tsx`
- Modify: `src/app/[slug]/[productSlug]/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/DashboardLayoutContent.tsx`
- Modify: `src/app/dashboard/settings/SettingsForm.tsx`
- Modify: `src/app/dashboard/settings/CalendarConnection.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/components/AudienceMarquee.tsx`
- Modify: `src/components/ClosingCTA.tsx`
- Modify: `src/components/FAQ.tsx`
- Modify: `src/components/FeaturedShops.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/components/Hero.tsx`
- Modify: `src/components/HowItWorks.tsx`
- Modify: `src/components/Testimonial.tsx`
- Modify: `src/components/WhyUs.tsx`
- Modify: affected component and page tests under `src/**/*.test.tsx`
- Create: `src/lib/brand-source.test.ts`

**Interfaces:**
- Consumes: constants and URL helpers from `@/lib/brand`.
- Produces: BUYKUB metadata, copy, legal contact details, and canonical copy-link values.

- [ ] **Step 1: Read the installed Next.js metadata guidance**

Run:

```bash
sed -n '1,240p' node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md
```

Expected: confirm `metadataBase`, static `metadata`, and `generateMetadata` conventions for this installed Next.js version.

- [ ] **Step 2: Update existing expectations and add a failing legacy-brand source guard**

Update focused expectations to require:

```ts
expect(screen.getByText("buykub.com/example")).toBeInTheDocument();
expect(slugInput.previousElementSibling).toHaveTextContent("buykub.com/");
expect(screen.getByText("ตัวอย่างร้านที่สร้างได้บน BUYKUB")).toBeInTheDocument();
expect(screen.getByText("support@buykub.com")).toBeInTheDocument();
```

Add `src/lib/brand-source.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("customer-facing brand source", () => {
  it("does not contain the legacy customer brand or domain", () => {
    const output = execFileSync(
      "rg",
      [
        "-n",
        "FRAMELINK|Framelink|framelink\\.app|hello@framelink\\.app",
        "src",
        "--glob",
        "!**/*.test.*",
      ],
      { encoding: "utf8" },
    );
    expect(output).toBe("");
  });
});
```

Implement the guard so `rg` exit code 1 is treated as an empty successful
result rather than a thrown child-process error.

- [ ] **Step 3: Run affected tests and verify RED**

Run:

```bash
npm test -- \
  src/lib/brand-source.test.ts \
  src/components/__tests__/ClosingCTA.test.tsx \
  src/components/__tests__/FeaturedShops.test.tsx \
  src/components/__tests__/LandingCopy.test.tsx \
  src/app/dashboard/DashboardLayoutContent.test.tsx \
  src/app/dashboard/settings/__tests__/SettingsForm.test.tsx \
  src/app/terms/page.test.tsx
```

Expected: FAIL on the old domain, old legal contact, and legacy brand source.

- [ ] **Step 4: Replace customer identity with shared brand values**

Use `BRAND_NAME`, `BRAND_DOMAIN`, `BRAND_ORIGIN`, `SUPPORT_EMAIL`, and
`shopUrl()` in runtime code. Set root metadata to:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(BRAND_ORIGIN),
  title: "BUYKUB — แปะลิงก์ ขายได้เลย",
  description: "ร้านค้าออนไลน์ในลิงก์เดียว สำหรับครีเอเตอร์ไทย",
};
```

Keep plain domain prefixes such as `buykub.com/` in split fields, use full
`https://buykub.com/{slug}` values for copy-link actions, and use
`support@buykub.com` on Terms and Privacy pages.

- [ ] **Step 5: Make the source guard robust and run affected tests GREEN**

Run the command from Step 3.

Expected: all listed tests pass and the guard finds no legacy customer-facing
brand strings.

- [ ] **Step 6: Commit the application rebrand**

```bash
git add src
git commit -m "feat: apply BUYKUB identity across the app"
```

---

### Task 4: Product-key email identity

**Files:**
- Modify: `supabase/functions/send-product-key/email.ts`
- Modify: `supabase/functions/send-product-key/email.test.ts`
- Modify: `supabase/functions/send-product-key/index.ts`
- Modify: `supabase/functions/send-product-key/README.md`

**Interfaces:**
- Consumes: existing `ProductKeyEmailInput`.
- Produces: email HTML branded `BUYKUB`, fallback shop name `BUYKUB`, sender documentation `BUYKUB <orders@mail.buykub.com>`, and Reply-To `support@buykub.com`.

- [ ] **Step 1: Add failing email identity assertions**

```ts
it("uses BUYKUB identity without the legacy brand", () => {
  const email = buildProductKeyEmail({
    shopName: "BUYKUB Demo",
    productName: "Windows Key",
    orderId: "12345678-abcd",
    keyValue: "AAAA-BBBB-CCCC",
  });

  expect(email.html).toContain("BUYKUB");
  expect(email.html).not.toMatch(/FRAMELINK|Framelink/);
});
```

- [ ] **Step 2: Run the Edge Function email tests and verify RED**

Run: `npm test -- supabase/functions/send-product-key/email.test.ts`

Expected: FAIL because the HTML still contains `FRAMELINK`.

- [ ] **Step 3: Apply the deployment-safe BUYKUB defaults**

Change the email HTML label to `BUYKUB`, change the missing shop fallback to
`BUYKUB`, retain `support@buykub.com` as the default Reply-To, and document:

```bash
npx supabase secrets set RESEND_FROM_EMAIL='BUYKUB <orders@mail.buykub.com>'
```

- [ ] **Step 4: Run the email tests and verify GREEN**

Run: `npm test -- supabase/functions/send-product-key/email.test.ts`

Expected: email tests pass.

- [ ] **Step 5: Deploy the updated Edge Function and verify its active version**

Run:

```bash
npx supabase functions deploy send-product-key \
  --project-ref palyrekrakepgsfhtpqn --no-verify-jwt
npx supabase functions list --project-ref palyrekrakepgsfhtpqn
```

Expected: `send-product-key` is `ACTIVE` with a newer version.

- [ ] **Step 6: Commit the email rebrand**

```bash
git add supabase/functions/send-product-key
git commit -m "feat: brand product key emails as BUYKUB"
```

---

### Task 5: Production verification, browser QA, and integration

**Files:**
- Modify only if required by failures found in this task.

**Interfaces:**
- Consumes: all deliverables from Tasks 1–4.
- Produces: verified feature branch, fast-forwarded `main`, and a concrete hosting/DNS handoff.

- [ ] **Step 1: Read the installed Next.js deployment guidance**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/02-guides/production-checklist.md
```

- [ ] **Step 2: Run complete automated verification**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: 0 failed tests, ESLint exit 0, TypeScript exit 0, production build
exit 0, and no whitespace errors.

- [ ] **Step 3: Run browser QA on the local production candidate**

Check at desktop and mobile widths:

- `/` shows the BUYKUB wordmark and `buykub.com` examples.
- `/login` shows BUYKUB.
- `/dashboard` shows and copies `https://buykub.com/{slug}`.
- `/dashboard/settings` displays `buykub.com/` around the editable slug.
- `/{slug}` identifies BUYKUB without changing the route.
- `/terms` and `/privacy` show `support@buykub.com`.

Expected: no visible clipping, legacy brand, old domain, or inaccessible
wordmark.

- [ ] **Step 4: Confirm both worktrees are clean and fast-forward `main`**

Run:

```bash
git status --short
git -C /Users/phawit/easysell status --short
git -C /Users/phawit/easysell merge --ff-only codex/pixza-product-parity
```

Expected: both status checks are empty and `main` fast-forwards without a merge
commit. If the main worktree is dirty, stop and report the overlapping files;
do not overwrite user changes.

- [ ] **Step 5: Inspect hosting configuration without creating an external project**

Run:

```bash
find /Users/phawit/easysell -maxdepth 3 \
  \( -name '.openai' -o -name 'vercel.json' -o -name 'netlify.toml' -o -name 'fly.toml' \) \
  -print
git -C /Users/phawit/easysell remote -v
```

Expected: if an existing supported hosting configuration is found, follow its
documented deployment workflow. If none exists, do not invent a provider;
report that hosting selection is the only blocker and provide the exact
`buykub.com` DNS records after the provider is selected.

- [ ] **Step 6: Final security and production-state report**

Report separately:

- application branch merged or exact reason it was not;
- Edge Function deployed version;
- automated and browser verification evidence;
- hosting/deployment state;
- Google OAuth production verification remains a separate external-console
  task;
- payment remains explicitly mock and no real money is accepted.

