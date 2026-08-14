# QA Wave 13 and memory rotation

## Rotated 2026-08-10 private-hosted release

- Static-app scope stayed fixed: no PvP, backend, account, telemetry, bundled
  card art, or cross-device persistence.
- Clean commit `9f608fd5` passed all 16 qualification gates and was deployed to
  Pages project `conan-private-7302df07` as deployment
  `945de0aa-1af1-4836-86f1-b8048dc6d32e`.
- Access protects root and wildcard deployment domains with One-time PIN,
  exact approved emails, and sessions no longer than 12 hours.
- Operator data stays outside Git. Anonymous probes redirect to Access; PC and
  smartphone OTP login/game opening were accepted.

## Rotated 2026-08-10 UI quality evidence

- Landscape mobile preserves the desktop playmat composition at responsive
  scale. The common causal presentation is UI-only and cannot dispatch or skip
  engine actions.
- Replay projections never hydrate live continuations. Public full-match tests
  start at `#setup` and use only rendered decisions.
- Final evidence was Vitest 944 files / 7,797 tests, root Playwright 403 passed
  / 17 skipped, Meta Playwright 178 passed, plus typecheck, lint, and builds.
- UI defects became `BUG-298` through `BUG-302`; the external eight-person
  formative study remains unexecuted.

## 2026-08-14 Wave 13 decisions

- Human `sleepChar` and `stunChar` declared costs carry an exact selected UID
  witness. Explicit malformed, stale, duplicate, wrong-filter, or wrong-count
  witnesses fail closed in both simulation and payment.
- Cost selection precedence is explicit witness, then legacy `ctx.picked`, then
  deterministic fallback. The witness is not written to `ctx.picked`, because
  that context continues into the ability effect.
- ChoicePicker cancellation remains `cancelled`; an out-of-range choice index
  is `not-allowed`.
- Compact MATCH owns the incident-edition status inside the incident header,
  separates incident/evidence rows, and keeps a single FILE heading.
- Incident candidates hide the detail control so the entire incident card is
  the selection target. Normal incident detail keeps a transparent 44px hit
  area with a 26.7px visible control.
