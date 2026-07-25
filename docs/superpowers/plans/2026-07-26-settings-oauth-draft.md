# Settings OAuth Draft Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore unsaved Settings values after the Google Calendar OAuth round trip.

**Architecture:** Add a small pure draft-storage module around user-scoped `sessionStorage`, then hydrate and synchronize `SettingsForm` through that boundary. Clear the draft only after an explicit save succeeds.

**Tech Stack:** React 19, TypeScript, Web Storage API, Vitest, Testing Library.

## Global Constraints

- Persist every editable Settings value.
- Scope drafts by `userId` and browser tab.
- Ignore invalid stored values without breaking the form.
- Clear drafts only after a successful explicit save.

---

### Task 1: Define draft storage behavior

**Files:**
- Create: `src/app/dashboard/settings/settings-draft.ts`
- Create: `src/app/dashboard/settings/settings-draft.test.ts`

**Interfaces:**
- Produces: `SettingsDraft`, `readSettingsDraft(userId)`, `writeSettingsDraft(userId, draft)`, and `clearSettingsDraft(userId)`.

- [ ] Write tests proving round-trip storage, user isolation, malformed JSON handling, and clearing.
- [ ] Run `npm test -- src/app/dashboard/settings/settings-draft.test.ts` and verify RED because the module does not exist.
- [ ] Implement the minimal guarded sessionStorage adapter.
- [ ] Re-run the test and verify GREEN.

### Task 2: Integrate draft recovery into Settings

**Files:**
- Modify: `src/app/dashboard/settings/SettingsForm.tsx`
- Modify: `src/app/dashboard/settings/__tests__/SettingsForm.test.tsx`

**Interfaces:**
- Consumes: the draft storage API from Task 1.
- Produces: Settings form state that survives unmount/remount and clears after successful save.

- [ ] Add a regression test that edits name, bio, color, payout method, and bank details, unmounts, then remounts the same user and observes restored values.
- [ ] Add a test that a successful save clears the draft.
- [ ] Run the focused test and verify RED.
- [ ] Initialize state from the stored draft and synchronize changes after hydration without overwriting an existing draft during initial render.
- [ ] Clear the draft after the save promise resolves.
- [ ] Run focused tests and verify GREEN.

### Task 3: Verify

**Files:**
- Modify only files implicated by verification failures.

- [ ] Run `npm test -- src/app/dashboard/settings/settings-draft.test.ts src/app/dashboard/settings/__tests__/SettingsForm.test.tsx`.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] Confirm `git diff --check` and commit the implementation.

