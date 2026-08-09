# Private Hosted Phase 3-4 Handoff

Date: 2026-08-04
Status: Phase 4 Task 3 boundary; no Cloudflare account or resource configured

## Release invariant

- Ship the existing Vite feature set as static files. Preserve YOU-vs-CPU, rules,
  cards, setup, tutorial, and replay. Do not add PvP or a backend.
- Retained product deltas are limited to restoring existing flows: strip UI-only
  decision IDs at one resolver guard, use area-qualified hand occurrence IDs, and
  enforce 44px smartphone tap targets. No rules, CPU, or match outcome changes.
- Required inspection is limited to build, dependencies, embedded secrets, and
  literal external destinations. Advanced runtime-flow analysis is optional.
- Never upload bundled card images. Never enable public signup or public paths.
- Audience is a fixed named list, maximum 12 people including the operator.

## Phase 3 qualification contract

Run `npm run private-hosted:qualify-final` from one clean release commit. The
producer must execute these IDs exactly once and in this order:

1. `npm-ci`
2. `build`
3. `dependency-audit`
4. `bug-gate`
5. `typecheck`
6. `lint`
7. `unit`
8. `smoke`
9. `dev-e2e`
10. `docs`
11. `docs-check`
12. `prepare-release`
13. `secret-scan`
14. `destination-scan`
15. `prepared-private-e2e`
16. `clean-tree-check`

Secret and destination scans inspect the exact staged upload payload. Acceptance
requires exit code 0 for every command, empty findings, stable commit/lockfile/
manifests, an atomically published repository-external report, and a clean tree.
This does not authorize Cloudflare setup or deployment.

## Phase 4 Task 1: operator config implementation

- `private-hosted:init` writes strict operator configuration outside the repo.
- It validates account/project/team identifiers, lowercase exact emails,
  uniqueness, operator membership, maximum 12, path containment, file identity,
  and restrictive local permissions.
- The config contains no token or password.

## Phase 4 Task 2: read-only Access auditor implementation

- `private-hosted:audit` uses read-only Cloudflare API access plus anonymous
  root/wildcard probes. It never creates, changes, or deletes Cloudflare state.
- It requires one Cloudflare login IdP, exact root and wildcard applications,
  exact email sets, the same required login method, bounded sessions, and no
  broad selectors, bypasses, public paths, extra apps, or alternate IdPs.
- Modes are `preflight` (operator only), `active` (approved list), and
  `contained` (Block Everyone, no Allow). Evidence is redacted and bounded.
- Every API and public probe has a fixed deadline and honors caller cancellation.
- Live audit cannot run until Task 3 supplies the external config and short-lived
  read-only token. Fixture tests and local qualification are completed first.

## Stop: Phase 4 Task 3 requires the operator

Do not continue automatically. The operator must:

1. Create the dedicated Cloudflare account and Zero Trust Free organization.
2. Configure Cloudflare account login as the sole Access identity provider;
   disable Email OTP, alternate IdPs, Access MFA, and account-member restriction.
3. Run `npm run private-hosted:init` and keep the JSON outside the repository.
4. Create a short-lived Pages Edit token and an empty Direct Upload project.
5. Create separate Access applications for the root and wildcard domains before
   any application bytes are uploaded; allow only the operator for preflight.
6. Create a separate short-lived read-only audit token. Never paste tokens into
   chat, files, command arguments, Git, or evidence.

After those steps, resume with preflight audit. Upload remains blocked until the
audit passes and the later release gates are explicitly accepted.
