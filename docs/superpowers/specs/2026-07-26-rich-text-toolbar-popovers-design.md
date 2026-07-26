# Rich Text Toolbar Popovers

## Goal

Make every control in the product-description toolbar reliable and
self-explanatory in both the create-product and edit-product flows.

## Existing Formatting Controls

Keep the nine existing Tiptap formatting commands:

1. Bold
2. Italic
3. Strike
4. Heading level 2
5. Heading level 3
6. Bullet list
7. Ordered list
8. Blockquote
9. Horizontal rule

Each button must retain an accessible Thai label, preserve the editor
selection when used, and update its pressed state where the command has an
active state.

## Link Popover

- Replace `window.prompt` with an inline popover anchored below the toolbar.
- Show a URL field, validation message, confirm button, and cancel button.
- If text is selected, apply the link to that selection.
- If no text is selected, insert the normalized URL as linked text.
- Accept `http://` and `https://` URLs.
- Add `https://` when the user enters a domain without a scheme.
- Reject unsupported or malformed URLs without changing editor content.
- When the cursor is inside an existing link, prefill its URL and allow
  updating or removing the link.

## YouTube Popover

- Replace `window.prompt` with an inline popover anchored below the toolbar.
- Show a YouTube URL field, validation message, confirm button, and cancel
  button.
- Accept standard YouTube watch, share, shorts, and embed URLs supported by
  the Tiptap YouTube extension.
- Reject non-YouTube or malformed URLs without changing editor content.
- Insert the video at the current selection and return focus to a usable text
  position after the embed.

## Popover Behavior

- Only one toolbar popover may be open at a time.
- Opening a popover stores the current editor selection so clicking and typing
  in the URL field does not lose the intended insertion range.
- Escape and Cancel close the popover without changing content.
- Confirm closes the popover only after a successful command.
- Errors remain visible and associated with their input.
- Toolbar and popover controls are keyboard accessible.

## Testing

- Add component tests proving the observable HTML result for all nine
  formatting commands.
- Add link tests for selected text, an empty selection, normalization,
  editing/removal, cancellation, and invalid URLs.
- Add video tests for accepted YouTube URL forms, cancellation, and invalid
  URLs.
- Add product-editor integration coverage proving the toolbar works in both
  create and edit modes and that the resulting description HTML reaches the
  save payload.
- Run the complete test, lint, typecheck, and production-build suite.

