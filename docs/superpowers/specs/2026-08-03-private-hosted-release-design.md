# Private Hosted Release Design

Date: 2026-08-04 — Existing-app direction approved; Cloudflare setup not performed

## Goal and audience boundary

- Host the existing app for a fixed, named, small circle of family and acquaintances
  to use on smartphones.
- No public signup, transferable invitation, anonymous access, discoverable page,
  monetization, advertising, donation, or analytics.
- The approved email list is capped at 12 people including the operator. Changes
  require operator approval and a fresh Access audit.
- This remains a fan project. Access restriction, small scale, and no revenue do
  not grant rights or conclusively determine whether an act is public transmission.
- Hosting copies application and card/rules data to a server. A rightsholder request
  or material legal concern triggers containment and suspension; see the legal note.

## Product shipped

- Deploy the current production Vite build with its engine, cards, setup, tutorial,
  replay import, and YOU-vs-CPU behavior unchanged.
- No human-vs-human play, accounts, shared state, backend, matchmaking, chat, or
  cross-device persistence is added.
- Card-image bytes are not bundled, staged, uploaded, or server-hosted. The browser
  may request existing official image URLs; failure uses the local SVG placeholder.
- No service worker, PWA, source map, server runtime, remote logging, telemetry,
  browser persistence, or development bridge is shipped.
- Match, tutorial, and imported replay state remain in memory and clear on reload.

## Static payload and runtime boundary

- Phase 1 defines the browser-only build and response headers. Phase 2 creates
  only an inspected, reproducible staging payload plus repo-external evidence.
- The production graph audit follows static, re-exported, dynamic, and CSS
  imports. It rejects network APIs, service workers, persistent storage,
  server-only modules, Vite runtime variables, unapproved external origins,
  dynamic production chunks, meta builds, and unsafe routing overrides.
- Runtime CSP is `connect-src 'none'`; scripts/styles/fonts are same-origin,
  workers and forms are disabled, and images are limited to self, data, and the
  existing official image host.
- Every response requires no-store, noindex, no-referrer, nosniff, frame denial,
  and the exact restrictive CSP.

## Cloudflare architecture

- Use a dedicated Cloudflare account, one empty Pages Direct Upload project, and
  two Access applications: the project root and wildcard deployment domain.
- The sole identity provider is Cloudflare login. Email OTP and independent
  Access MFA are disabled. Access has no shared site password.
- Both applications allow only that IdP, auto-redirect to it, reject WARP
  authentication, and require the same Login Method in an Allow policy.
- `preflight`: exactly the operator email, session at most 30 minutes.
- `active`: exactly all approved emails, session at most 12 hours.
- `contained`: exactly one `Block Everyone` policy on each application,
  with no Allow, Exclude, or Require rules.
- Broad selectors, Bypass, Service Auth, alternate IdPs, public paths, extra apps,
  and policy overlap fail audit.
- Access protects both the stable project URL and every deployment URL before
  any real application bytes are uploaded.

## Authority and secrets

- Strict operator JSON stays outside the repository and contains identifiers/emails,
  not credentials. Links, hard links, broad-write ACLs, swaps, and repo paths fail.
- The OS operator/admin account is trusted. API tokens are short-lived, process-
  environment-only, and never enter config, evidence, logs, arguments, or Git.
- Pages and Access tokens stay separate. The read-only auditor paginates all results,
  strips ambient credentials, redacts API data, and emits bounded evidence.
- Account, Zero Trust, tokens, empty project, and Access applications are
  user-operated Phase 4 Task 3 work. Implementation stops before that task.

## Qualification and release gates

- Phase 3 must pass the runtime boundary, bug gate, typecheck, lint, full unit
  suite, 1,000-game smoke, development E2E, dependency audit, docs checks,
  payload preparation, and production-static Playwright suite.
- Static Playwright uses public controls and covers desktop/mobile setup, gameplay,
  tutorial, replay, reset, image fallback, staged bytes/headers, and runtime errors.
- The final qualification producer starts and ends on the same clean commit and
  lockfile, rehashes manifests after E2E, and writes a report only after every
  command passes once in the required order.
- No Pages project, Access application, external endpoint, or upload is created
  by Phases 3 or Phase 4 Tasks 1-2.
- Release stays blocked until Task 3, preflight audit, deployment gates, and user
  acceptance of documented rights and operational residual risks are complete.

## Operations

- Containment is fail-closed and never auto-unblocks. It applies `Block
  Everyone` to root/wildcard before rollback or deletion work.
- Removing a user means removing the exact email and revoking its sessions for
  both applications. Adding a user requires a deliberate audited change.
- Keep redacted evidence locally, rotate/revoke tokens after use, and never
  publish the repository or payload outside the fixed named circle.

## Current sources
- [Project legal recommendation](../../../.claude/research/legal/04-recommendation.md)
- [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Cloudflare common Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/)
- [Cloudflare Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/)
