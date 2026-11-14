# BUYKUB isolated database schema implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Persist login profiles and load application data in a separate `buykub` schema in the existing buykub-th project.

**Architecture:** Route application database clients to an explicitly configured schema. Bootstrap the existing application tables and policies into `buykub`, keeping existing public tables, authentication users, and credentials intact. Expose only `buykub` through Data API with row-level security.

**Tech Stack:** Next.js 16.2, Supabase JS/SSR, PostgreSQL, Vitest.

**Spec:** User approved an isolated schema in buykub-th and preservation of all existing tables.

## Global constraints

- Do not modify or expose existing public tables.
- Preserve the user's unrelated working changes.
- Read installed Next.js documentation before framework changes.
- Keep authentication in the existing auth schema; never copy or print session credentials.

## Review focus

- Every browser, server, anonymous, middleware and service client must use the intended schema.
- Anonymous requests must not read profiles or write shops.
- Logged-in users may read and update only their own private records.
- Database functions must resolve buykub tables, not same-named public tables.
- Existing auth users must be able to create their profile on their next normal login.

## Task 1: Client routing

- [x] Add tests asserting outgoing database profile headers for the configured schema and default compatibility.
- [x] Observe failures, implement schema options for all database clients, and rerun tests.

## Task 2: Isolated schema

- [x] Prepare an additive, transactional SQL bootstrap derived from the checked-in schema and migrations, with explicit schema search paths and RLS.
- [x] Verify current schema inventory and apply only to the new schema.
- [x] Configure Data API to expose only buykub; verify anonymous denials and allowed public reads.

## Task 3: End-to-end login

- [x] Repeat normal Google login and verify the profile is persisted in buykub.profiles.
- [x] Verify dashboard/settings reads and session persistence, then run tests, typecheck, lint and diff checks.
- [x] Report actual verification and any remaining limitations without changing deployment or unrelated user data.

## Verification record (2026-11-12)

- Resumed buykub-th, repaired local project URL/publishable-key connection, verified Google provider and localhost callback allowlist.
- Client routing tests observed failing with public headers, then passed with configured buykub headers; default public compatibility also passes.
- Bootstrap applied successfully: 10 buykub tables, every table has RLS; original public table count remains 223.
- Temporarily pinned PostgREST to buykub while enabling Data API. Saved dashboard exposed schemas as buykub only, then removed temporary role override. Real requests still return buykub 200 and public 406.
- Anonymous profiles and shop payout fields return 401; anonymous storefront product/service reads return 200.
- Normal Google sign-out/sign-in persisted the current user's profile; dashboard reload retained session; settings loaded. Transactional RLS assertions prove owner sees the profile and a different account does not.
- Full suite: 58 files, 175 tests passed. Typecheck and scoped ESLint passed; diff whitespace check passed. Final test-variable rename verified by targeted 6-test routing rerun.
- Independent fresh-context review found no serious code defects; its pending local environment concern was resolved and remote Edge Function prerequisites documented in README.

## Scope decisions

- Keep current checkout and preserve unrelated in-progress Stripe changes so the running local site reflects this repair. No commit, push, or deployment performed.
- Use existing application schema and current migrations but exclude shared Storage setup. Payment, email, Calendar and file uploads are not verified as part of login; Edge Function deployment requires SUPABASE_DB_SCHEMA=buykub and service credentials.
- Verify anonymous shop writes through database privilege inspection instead of submitting a potentially persistent fabricated shop.
