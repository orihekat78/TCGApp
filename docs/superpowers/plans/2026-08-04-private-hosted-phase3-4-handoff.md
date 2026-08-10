# Private Hosted Phase 3-4 Handoff

Date: 2026-08-10
Status: Production deployed; PC and smartphone acceptance complete

## Release invariant

- Ship the existing static Vite app. Preserve YOU-vs-CPU, rules, cards, setup,
  tutorial, and replay. Do not add PvP or a backend.
- Never upload bundled card images. Never enable public signup or public paths.
- Audience is a fixed named list, maximum 12 people including the operator.
- Required inspection is build, dependencies, embedded secrets, and literal external
  destinations. Advanced runtime-flow analysis is optional.

## Qualification contract

`npm run private-hosted:qualify-final` must run from one clean release commit and
execute these IDs once in order:

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

Acceptance requires every exit code 0, empty scan findings, stable commit/lockfile/
manifests, a repository-external report, and a clean tree.

## Operator config and Access auditor

- `private-hosted:init` writes strict ID/email configuration outside the repository.
- Config contains no token or password and caps the approved list at 12.
- `private-hosted:audit` is read-only. It checks API state plus anonymous root and
  wildcard probes and emits bounded, redacted evidence.
- Required state: one One-time PIN IdP; exact root/wildcard applications; exact email
  sets; no policy Require/Exclude; bounded sessions; no broad selectors or bypasses.
- Modes: `preflight` operator only, `active` approved list, and `contained` Block Everyone.

## Phase 4 Task 3 completion evidence

- Cloudflare account ID: `8b2b1b63c5cf8d5c49dcc608b730dd10`.
- Zero Trust team: `steep-mouse-bb22`.
- Pages project: `conan-private-7302df07`; production branch: `main`.
- Root Access app: `85536426-8d52-4c43-a42b-8f12beb0d1e6`.
- Wildcard Access app: `77346ed1-a299-4acf-91b2-9b73530dea9c`.
- Sole approved operator email is kept in repo-external config; session maximum: 12h.
- Authentication: One-time PIN only; independent MFA and WARP login disabled.
- Qualified commit: `9f608fd5bff7249ee1aa59ba1b101cfb884d5ea3`.
- Deployment: `945de0aa-1af1-4836-86f1-b8048dc6d32e`.
- Stable URL: `https://conan-private-7302df07.pages.dev/`.
- Exact deployment URL: `https://945de0aa.conan-private-7302df07.pages.dev/`.
- Anonymous root/deployment probes returned Access redirects. OTP login and game open
  were accepted on PC and smartphone. Temporary setup token was revoked.

## Next operational action

No feature implementation remains for this release. Follow the
[production operations runbook](2026-08-10-private-hosted-production-operations.md)
for later releases, membership changes, emergency containment, and rollback.
