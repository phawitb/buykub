# Settings OAuth draft preservation design

## Goal

Preserve unsaved Settings form values when Google Calendar OAuth navigates away from Framelink and returns through the callback route.

## Design

`SettingsForm` owns the complete editable shop state, so it also owns draft persistence. A user-scoped key stores the current form value in `sessionStorage`. The form restores that value on mount, then keeps the stored draft synchronized whenever an editable value changes.

The draft contains slug, name, bio, avatar and cover URLs, accent color, payout method, PromptPay ID, and bank details. It never contains OAuth tokens or authentication data.

The storage is scoped to the current browser tab by `sessionStorage` and to the current account by including `userId` in the key. A successful explicit Settings save removes the draft. Failed saves retain it.

Malformed, inaccessible, or structurally invalid storage is ignored so Settings continues to load from the server value without crashing.

## Verification

- A unit test changes fields, unmounts the form, remounts it for the same user, and observes the draft values.
- A different user does not receive another user's draft.
- A successful save clears the stored draft.
- Existing Settings validation tests remain green.

