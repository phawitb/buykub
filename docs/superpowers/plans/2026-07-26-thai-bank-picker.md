# Thai Bank Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible Thai-bank payout picker with exact supplied logos and structured account details.

**Architecture:** Centralize bank metadata and bank-detail serialization in a pure module. A focused `BankAccountFields` component owns the picker dialog while `SettingsForm` owns persistence, validation, and save payloads.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Next.js Image, Vitest, Testing Library, Sharp asset cropping.

## Global Constraints

- Include only the 16 approved Thai retail banks.
- Crop logos from the supplied screenshots; do not regenerate them.
- Preserve legacy `bank_details` text.
- Preserve all new values through the existing OAuth draft mechanism.
- Require bank, 6–16 digit account number, and account name.

---

### Task 1: Bank assets and data model

**Files:**
- Create: `public/banks/*.png`
- Create: `src/app/dashboard/settings/thai-banks.ts`
- Create: `src/app/dashboard/settings/thai-banks.test.ts`

- [ ] Add failing tests for the 16-bank list, JSON round trip, legacy fallback, filtering, and validation.
- [ ] Run the test and verify RED.
- [ ] Crop the 16 source logos into square PNG assets.
- [ ] Implement bank metadata, parser, serializer, search helper, and validation.
- [ ] Run the test and verify GREEN.

### Task 2: Bank selector UI

**Files:**
- Create: `src/app/dashboard/settings/BankAccountFields.tsx`
- Create: `src/app/dashboard/settings/BankAccountFields.test.tsx`

- [ ] Add failing tests for empty state, dialog opening, search, selection, selected card, account fields, and close behavior.
- [ ] Run the test and verify RED.
- [ ] Implement the accessible responsive picker and account fields.
- [ ] Run the test and verify GREEN.

### Task 3: Settings integration and OAuth draft

**Files:**
- Modify: `src/app/dashboard/settings/SettingsForm.tsx`
- Modify: `src/app/dashboard/settings/settings-draft.ts`
- Modify: `src/app/dashboard/settings/settings-draft.test.ts`
- Modify: `src/app/dashboard/settings/__tests__/SettingsForm.test.tsx`

- [ ] Add failing tests for structured save payload, validation messages, legacy values, and OAuth-style remount restoration.
- [ ] Run focused tests and verify RED.
- [ ] Integrate bank state, draft fields, validation, and serialized save payload.
- [ ] Run focused tests and verify GREEN.

### Task 4: Verification

- [ ] Run all focused bank and Settings tests.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] Run desktop and mobile browser smoke checks.
- [ ] Confirm `git diff --check` and commit.

