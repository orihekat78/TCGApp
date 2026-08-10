# Private Hosted Release Design

Date: 2026-08-10 — Production deployed and accepted

## Goal and audience boundary

- Host the existing app for a fixed, named, small circle of family and acquaintances.
- No public signup, transferable invitation, anonymous access, discoverable page,
  monetization, advertising, donation, or analytics.
- The approved email list is capped at 12 people including the operator. Changes
  require operator approval and a fresh Access audit.
- This remains a fan project. Restricted, small-scale, noncommercial access does
  not grant rights. A rightsholder request triggers immediate containment.

## Product shipped

- Ship the same Vite product: engine, cards, setup, tutorial, replay, and YOU-vs-CPU.
- No PvP, accounts, backend, matchmaking, chat, or cross-device persistence.
- Card-image bytes are not bundled or hosted. The browser may request the existing
  official image host; failure uses the local SVG placeholder.
- No service worker, PWA, source map, server runtime, telemetry, or remote logging.
- Match, tutorial, and imported replay state remain in memory and clear on reload.

## Static payload and inspection

- Required release inspection includes build and dependency checks, repository gates,
  advanced runtime-boundary analysis, embedded secrets, and literal external
  destinations.
- Secret and destination scans inspect the exact staged upload payload. Evidence
  records redacted labels or origins, never URL paths, queries, or credentials.
- Dynamic alias/runtime-flow analysis is a mandatory, fail-closed release gate.
- Runtime CSP permits only the official Conan Card Game site for NEWS reads; scripts, styles, and fonts are same-origin.
- Every response uses no-store, noindex, no-referrer, nosniff, frame denial, and CSP.

## Cloudflare architecture

- Dedicated Pages Direct Upload project: `conan-private-7302df07`.
- Access protects both `conan-private-7302df07.pages.dev` and
  `*.conan-private-7302df07.pages.dev` before application bytes are uploaded.
- The sole identity provider is Cloudflare One-time PIN. Cloudflare account login,
  alternate IdPs, shared passwords, WARP authentication, and independent MFA are off.
- Both applications allow only that IdP and auto-redirect to it.
- Active policy: exact approved emails only, no Exclude or Require rules, 12h maximum.
- Contained policy: exactly one Block Everyone policy on each application and no Allow.
- Broad selectors, bypass, alternate IdPs, public paths, extra apps, or overlap fail audit.

## Authority and secrets

- Strict operator JSON stays outside the repository and contains IDs/emails only.
- API credentials are short-lived, environment-only, and never enter config, logs,
  arguments, evidence, chat, or Git.
- The temporary setup token was revoked after deployment. Browser OAuth handles Pages.
- The read-only auditor paginates results, strips ambient credentials, and redacts API data.

## Qualification and release

- Final qualification runs 17 ordered gates: install, build, dependency audit, bug gate,
  typecheck, lint, unit, smoke, development E2E, docs generation, docs check, advanced
  runtime-boundary audit, preparation, exact-payload secret and destination scans,
  static E2E, and clean-tree verification.
- The previous 16-gate qualification passed for clean commit
  `9f608fd5bff7249ee1aa59ba1b101cfb884d5ea3`.
- Production deployment `945de0aa-1af1-4836-86f1-b8048dc6d32e` uploaded the exact
  qualified staging payload. Anonymous root and wildcard probes redirect to Access.
- OTP login and gameplay opening were accepted on PC and smartphone.

## Operations

- Containment is fail-closed and never auto-unblocks. Apply Block Everyone to root and
  wildcard before rollback, deletion, investigation, or rights-response work.
- Removing a user means removing the exact email and revoking its sessions. Adding one
  requires an approved config/policy change and fresh audit.
- Detailed release, membership, containment, and rollback steps are in the
  [production operations runbook](../plans/2026-08-10-private-hosted-production-operations.md).

## Sources

- [Project legal recommendation](../../../.claude/research/legal/04-recommendation.md)
- [Cloudflare One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Cloudflare session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
- [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
