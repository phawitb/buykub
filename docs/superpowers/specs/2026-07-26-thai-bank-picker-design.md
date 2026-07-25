# Thai bank picker design

## Goal

Replace the free-form bank payout field in Settings with a mobile-friendly Thai bank picker and structured account fields.

## Bank scope

The picker contains 16 retail banks available for domestic transfers in Thailand:

1. Siam Commercial Bank (SCB)
2. Bangkok Bank
3. Kasikornbank
4. Krungthai Bank
5. ttb
6. Bank of Ayudhya (Krungsri)
7. CIMB Thai
8. Land and Houses Bank
9. UOB Thailand
10. Kiatnakin Phatra Bank
11. TISCO Bank
12. Thai Credit Bank
13. Government Savings Bank
14. Bank for Agriculture and Agricultural Cooperatives
15. Government Housing Bank
16. Islamic Bank of Thailand

Citibank, Standard Chartered, ICBC, Deutsche Bank, HSBC, and SMBC are excluded.

## Interaction

Choosing “โอนเข้าบัญชีธนาคาร” reveals a bank selector followed by separate account-number and account-name fields. The selector opens an accessible dialog with search, popular banks first, all remaining banks below, selected-state feedback, keyboard dismissal, and a mobile bottom-sheet layout.

The selected bank card displays its cropped logo, Thai name, short code, and a change affordance. Logos are cropped from the user-supplied screenshots and are not regenerated.

## Persistence

Structured bank details are serialized into the existing `shops.bank_details` text column as versioned JSON. Legacy plain-text values continue to render in a fallback field so existing data is not discarded.

The existing Settings `sessionStorage` draft expands to cover selected bank code, account number, and account name. OAuth round trips therefore preserve the new bank form as well.

## Validation

Bank payout requires a selected bank, an account number containing 6–16 digits, and a non-empty account name. Errors identify the missing or invalid field.

## Verification

- Unit tests cover serialization, legacy parsing, filtering, and validation.
- Component tests cover opening the dialog, searching, choosing a bank, editing account data, OAuth-style remount recovery, and save payload serialization.
- Visual smoke checks cover desktop and mobile geometry.
- Full tests, lint, typecheck, and production build must pass.

