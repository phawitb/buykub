# Rich Text Toolbar Popovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all eleven product-description toolbar controls reliable, replace native prompts with accessible link and YouTube popovers, and prove the resulting HTML is saved in create and edit flows.

**Architecture:** Keep Tiptap command ownership in `RichTextEditor`, extract URL normalization and validation into a small pure helper, and preserve editor selections before focus moves into a popover. Component tests exercise real Tiptap output; ProductEditor tests verify the HTML crosses the save boundary.

**Tech Stack:** React 19, Tiptap 3, TypeScript, Vitest, Testing Library, Next.js 16.

## Global Constraints

- Native `window.prompt` must not be used.
- Only one toolbar popover may be open at a time.
- Link input accepts `http://`, `https://`, or a bare domain normalized to `https://`.
- Video input accepts YouTube watch, share, shorts, and embed URLs only.
- Existing Thai accessible labels remain stable.
- Every production change follows a red-green TDD cycle.

---

### Task 1: URL validation boundary

**Files:**
- Create: `src/features/products/components/rich-text-urls.ts`
- Create: `src/features/products/components/__tests__/rich-text-urls.test.ts`

**Interfaces:**
- Produces: `normalizeLinkUrl(value: string): string | null`
- Produces: `normalizeYoutubeUrl(value: string): string | null`

- [ ] **Step 1: Write failing table-driven tests**

Test literal inputs and expected outputs:

```ts
expect(normalizeLinkUrl("example.com")).toBe("https://example.com/");
expect(normalizeLinkUrl("https://example.com/path")).toBe(
  "https://example.com/path",
);
expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
expect(normalizeYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
);
expect(normalizeYoutubeUrl("https://example.com/video")).toBeNull();
```

- [ ] **Step 2: Run tests and verify RED**

Run:
`npm test -- src/features/products/components/__tests__/rich-text-urls.test.ts`

Expected: FAIL because `rich-text-urls.ts` does not exist.

- [ ] **Step 3: Implement minimal parsing**

Use `new URL()`, prepend `https://` only for link inputs without a URI scheme,
allow only HTTP(S), extract an 11-character YouTube video id from
`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, and
`youtube.com/embed/`, then return the canonical nocookie embed URL.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
`npm test -- src/features/products/components/__tests__/rich-text-urls.test.ts`

Expected: all URL cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/products/components/rich-text-urls.ts \
  src/features/products/components/__tests__/rich-text-urls.test.ts
git commit -m "feat: validate rich text embed URLs"
```

### Task 2: Formatting toolbar regression coverage

**Files:**
- Create: `src/features/products/components/__tests__/RichTextEditor.test.tsx`
- Modify: `src/features/products/components/RichTextEditor.tsx`

**Interfaces:**
- Consumes: `RichTextEditor({ value, onChange, maxCharacters })`
- Produces: observable HTML for nine existing formatting commands.

- [ ] **Step 1: Write failing real-editor tests**

Render `RichTextEditor`, enter `ข้อความทดสอบ` into
`[aria-label="รายละเอียดสินค้า"]`, select the content, click each accessible
toolbar button, and assert literal output fragments:

```ts
[
  ["ตัวหนา", "<strong>ข้อความทดสอบ</strong>"],
  ["ตัวเอียง", "<em>ข้อความทดสอบ</em>"],
  ["ขีดทับ", "<s>ข้อความทดสอบ</s>"],
  ["หัวข้อระดับ 2", "<h2>ข้อความทดสอบ</h2>"],
  ["หัวข้อระดับ 3", "<h3>ข้อความทดสอบ</h3>"],
  ["รายการหัวข้อ", "<ul>"],
  ["รายการลำดับเลข", "<ol>"],
  ["ข้อความอ้างอิง", "<blockquote>"],
]
```

Add a separate assertion that “เส้นแบ่ง” produces `<hr>`. Add an active-state
assertion after moving the cursor into bold content.

- [ ] **Step 2: Run tests and verify RED**

Run:
`npm test -- src/features/products/components/__tests__/RichTextEditor.test.tsx`

Expected: active-state test FAILS because toolbar state is read directly
without a reactive Tiptap selector.

- [ ] **Step 3: Make toolbar state reactive**

Use Tiptap `useEditorState` to subscribe to bold, italic, strike, heading,
list, blockquote, link, and character-count state. Keep command handlers on
the same editor instance and derive `aria-pressed` from the subscribed state.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
`npm test -- src/features/products/components/__tests__/RichTextEditor.test.tsx`

Expected: all nine formatting commands and active states PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/products/components/RichTextEditor.tsx \
  src/features/products/components/__tests__/RichTextEditor.test.tsx
git commit -m "test: cover rich text formatting toolbar"
```

### Task 3: Link popover

**Files:**
- Modify: `src/features/products/components/RichTextEditor.tsx`
- Modify: `src/features/products/components/__tests__/RichTextEditor.test.tsx`

**Interfaces:**
- Consumes: `normalizeLinkUrl(value)`
- Produces: inline form labeled `เพิ่มลิงก์`, URL input labeled
  `URL ลิงก์`, buttons `เพิ่มลิงก์`, `ลบลิงก์`, and `ยกเลิก`.

- [ ] **Step 1: Write failing link behavior tests**

Cover selected text, empty selection, invalid URL, bare-domain normalization,
cancel, editing an existing link, and removal. Assert real editor HTML, for
example:

```ts
expect(onChange).toHaveBeenLastCalledWith(
  '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com/">ข้อความทดสอบ</a></p>',
);
```

Also assert invalid input renders `กรอก URL ที่ขึ้นต้นด้วย http:// หรือ
https://` and leaves HTML unchanged.

- [ ] **Step 2: Run tests and verify RED**

Run:
`npm test -- src/features/products/components/__tests__/RichTextEditor.test.tsx`

Expected: FAIL because clicking the link button still invokes
`window.prompt`.

- [ ] **Step 3: Implement the popover**

Store `popover: "link" | "video" | null`, `urlValue`, `urlError`, and a Tiptap
selection snapshot `{ from, to }`. On open, save selection and prefill an
existing link. On confirm, restore the selection, normalize the URL, apply it
to selected text or insert URL text with a link mark, then close. Cancel and
Escape close without editor changes. Render errors with `role="alert"` and
`aria-describedby`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
`npm test -- src/features/products/components/__tests__/RichTextEditor.test.tsx`

Expected: all link cases PASS and no test observes `window.prompt`.

- [ ] **Step 5: Commit**

```bash
git add src/features/products/components/RichTextEditor.tsx \
  src/features/products/components/__tests__/RichTextEditor.test.tsx
git commit -m "feat: add rich text link popover"
```

### Task 4: YouTube popover

**Files:**
- Modify: `src/features/products/components/RichTextEditor.tsx`
- Modify: `src/features/products/components/__tests__/RichTextEditor.test.tsx`

**Interfaces:**
- Consumes: `normalizeYoutubeUrl(value)`
- Produces: inline form labeled `เพิ่มวิดีโอ YouTube`, URL input labeled
  `URL YouTube`, buttons `เพิ่มวิดีโอ` and `ยกเลิก`.

- [ ] **Step 1: Write failing video behavior tests**

Submit a valid watch URL and assert an iframe with the canonical nocookie
source appears. Submit a non-YouTube URL and assert
`รองรับเฉพาะลิงก์ YouTube` without changing HTML. Verify Cancel and Escape
close the form without insertion.

- [ ] **Step 2: Run tests and verify RED**

Run:
`npm test -- src/features/products/components/__tests__/RichTextEditor.test.tsx`

Expected: FAIL because no inline YouTube form exists.

- [ ] **Step 3: Implement the video flow**

Reuse the one-popover state, restore the saved editor selection, call
`setYoutubeVideo({ src: canonicalUrl })`, move selection after the node, focus
the editor, and close the popover. Preserve the form and show an associated
error when normalization fails.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
`npm test -- src/features/products/components/__tests__/RichTextEditor.test.tsx`

Expected: valid, invalid, cancel, and Escape cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/products/components/RichTextEditor.tsx \
  src/features/products/components/__tests__/RichTextEditor.test.tsx
git commit -m "feat: add rich text YouTube popover"
```

### Task 5: Create/edit product integration

**Files:**
- Modify: `src/features/products/components/__tests__/ProductEditor.test.tsx`

**Interfaces:**
- Consumes: `ProductEditor` and `saveProduct(payload)`.
- Produces: regression proof that `descriptionHtml` contains toolbar output in
  both modes.

- [ ] **Step 1: Add create and edit integration tests**

In create mode, format description text and complete the minimum required
name, price, and product-file state before submit. In edit mode, modify
existing description HTML through the toolbar. Assert the literal
`descriptionHtml` passed to `saveProduct`.

- [ ] **Step 2: Run focused integration tests**

Run:
`npm test -- src/features/products/components/__tests__/ProductEditor.test.tsx`

Expected: both create and edit save-boundary assertions PASS; if either fails,
fix only the state plumbing responsible for the missing HTML.

- [ ] **Step 3: Run full verification**

Run:
`npm test && npm run lint && npm run typecheck && npm run build && git diff --check`

Expected: zero test failures, zero lint/type errors, build exit 0, and no
whitespace errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/products/components/__tests__/ProductEditor.test.tsx
git commit -m "test: verify rich text product save flows"
```

