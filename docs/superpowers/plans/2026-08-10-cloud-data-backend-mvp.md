# Cloud Data Backend MVP Implementation Plan

> **For agentic workers:** Use `superpowers:test-driven-development` for each task and `conan-verify` before completion claims.

**Goal:** Add authenticated, per-email deck synchronization and match-result storage for the meta-app without removing local persistence.

**Architecture:** Keep the meta-app local-first. Same-origin Pages Functions validate Cloudflare Access JWTs, derive the user server-side, authorize every D1 query by internal `user_id`, and return versioned JSON. Preview and production use separate D1 databases and Access audiences. Production remains unchanged until preview gates pass.

**Tech Stack:** React, TypeScript, Vite, Pages Functions, Cloudflare Access, D1, Vitest, Playwright.

## Global constraints

- Never trust client email, user ID, Access headers, or JWT claims without signature validation.
- Never store JWTs, OTPs, auth headers, API tokens, card images, or replay logs.
- Keep existing IndexedDB/localStorage data. Network failure must preserve local play and queue retryable writes.
- Initial scope: deck sync, active deck, match outcomes, derived statistics. No PvP, replay, or interrupted-match state.
- Reserve at least 75% of free-tier request/write capacity and database space for later work, including PvP.
- Release gates keep build, dependency audit, secret scan, and destination/CSP checks mandatory. Advanced runtime scanners remain diagnostic.

## Task 1: Database and identity foundation

**Files:** `migrations/0001_cloud_data.sql`, `migrations/environments/*.sql`, `src/cloud-data/{access-auth,identity,contracts,request-context,retention,usage-budget,d1-types}.ts`, `tests/cloud-data/*`.

1. Prove schema ownership, immutable identity, enrollment, environment sentinel, retention, and indexes with real SQLite tests.
2. Validate Access JWT through remote JWKS using issuer, audience, expiry, algorithm, application type, subject, and email.
3. Derive an HMAC email key using a server-only secret; cap production enrollment at 12 and preview at one verification account.
4. Run `npx vitest run tests/cloud-data`, `npm run typecheck`, and `npm run lint`.

**Done:** Unauthenticated, disabled, relinked, cross-environment, and cross-user paths fail closed; no raw credential appears in storage or errors.

## Task 2: D1 repository and idempotency

**Files:** `src/cloud-data/{repository,rate-limit}.ts`, `tests/cloud-data/{repository,rate-limit}.test.ts`.

1. Write failing integration tests against the production migration.
2. Add bootstrap, deck upsert/delete, active-deck update, match append, derived statistics, semantic replay handling, and optimistic revision conflicts.
3. Add atomic per-user admission: read 10/minute and 25/day, write 5/minute and 10/day, match 5/minute and 8/day.
4. Bound decks at 100, tombstones at 500, retained matches at 250; the 8/day match budget keeps the 31 UTC-day rolling boundary at 248. Materialize owner match statistics and keep every query owner-scoped.

**Done:** Same request replay succeeds, changed payload reuse returns conflict, cross-user IDs reveal no data, and quota excess returns 429 without mutation.

## Task 3: Same-origin HTTP API

**Files:** `src/cloud-data/api.ts`, `functions/api/v1/[[path]].ts`, `tests/cloud-data/api.test.ts`, TypeScript configuration as needed.

1. Implement `GET /api/v1/bootstrap`, `PUT|DELETE /api/v1/decks/:id`, `PUT /api/v1/active-deck`, and `POST /api/v1/matches`.
2. Require JSON, body limits, same-origin mutation requests, `Idempotency-Key`, strict contracts, and generic errors.
3. Return `Cache-Control: no-store`; never accept email or user ID in a write body.
4. Test missing/invalid Access JWT, origin spoofing, ID mismatch, replay, rate limit, and D1 failure.

**Done:** HTTP tests pass and Functions code typechecks without changing production routing.

## Task 4: Meta-app local-first synchronization

**Files:** `meta-app/src/data/types.ts`, `meta-app/src/state/{decksStore,historyStore}.ts`, new `meta-app/src/cloud/*`, related unit tests.

1. Keep canonical local repositories; add durable outbox and migration marker.
2. Import existing decks/history without deletion, using stable client IDs and idempotency keys.
3. Merge by server revision; surface conflicts and offline status without blocking play.
4. Save current CPU mode as requested/effective `normal` and a fixed policy version until CPU difficulty ships.

**Done:** Two-device sync works in tests; offline edits/play remain usable; reconnect retries once semantically; local data remains intact after every failure.

## Task 5: Release tooling and preview proof

**Files:** private-hosted release scripts/docs/tests, Pages/Wrangler config, CSP generation, Playwright specs.

1. Make `build:meta` the explicit private-hosted artifact and permit only same-origin `/api` through CSP.
2. Provision separate preview and production D1 databases; bind distinct Access audiences and server secrets.
3. Apply migrations to preview only, enroll only existing approved emails, and verify root plus wildcard Access protection.
4. Run build, dependency audit, secret scan, destination scan, full Vitest, lint, Playwright, D1 smoke, `cloud-data:measure-d1-budget`, backup/restore drill, and adversarial review.

**Done:** Preview passes on desktop and `851x393`; production deployment remains a separate approval and uses the exact qualified artifact.

## Rollback and cost boundary

- Disable the client sync flag first; local repositories continue unchanged. Roll back Functions/artifact without deleting D1.
- Export D1 before migration; restore into a new database and rebind after validation. Never overwrite the only copy.
- At 50% budget warn, 75% freeze optional expansion, and 90% force local-only. The modeled 12-production-plus-one-preview workload keeps two-times measured usage below 25% of each daily quota. Paid use or redesign is required if that proof fails, combined personal-sync storage approaches 50 MiB, or later PvP needs Durable Objects/WebSockets beyond remaining free quotas.
