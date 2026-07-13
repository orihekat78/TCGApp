# Next Session: Deferred Primitive Portfolio

## Current State

- branch: `main`; latest: `a3681d49 fix(ci): sync target forcing verb whitelist`.
- CL327 GitHub CI green: typecheck, full Vitest, lint chain, and smoke 1000.
- Shipped count: **2002 / 2074 printings; remaining 72**.
- Shipped: B02022/B02022P, B07030P/B07030P2/B07061P/B09055P/B09055P2/PR271, and B04042/B04042P/B04084.
- B02022 `mustTargetSelfOnce` has Sol CLEAN approval. Case targeting and partner-action exceptions are probed.
- Exact existing-DSL/twin closures are exhausted. Do not plan a 20-printing no-engine batch.
- Uncommitted preparation: `.claude/sessions/2026-07-13-2.md`.

## Start

1. Run `git status --short`; preserve session-preparation file unless intentionally committing documentation.
2. Read root/nested `AGENTS.md`, `.codex/context/current.md`, relevant rules, and `sessions/2026-07-13-2.md`.
3. Run `npm run ground -- <IDs>` before authoring. Four-cluster dossiers are in `.tmp/_ground/`.

## Portfolio

| Order | Primitive | Unlock | Risk |
|---|---|---:|---|
| 1 | self set-card targeted remove -> enter | B06012/P, B06064/P, B07033/P/P2, B09113/P = 9 | T3 |
| 2 | stacked identity / host stack | B06005/P, B08003/P, B08008 = 5 | T3 |
| 3 | choose-intercept / negate / opponent decision | B02067/P, B04003/P, B08081/P = 6 | T3 |

## Execution Rules

- Aggregate multi-pick shipped. Prepare remaining three; ship **one primitive at a time**.
- Main owns integration, Sol review, commit, CI, registry, DEFERRED-INDEX, recount, and memory.
- Keep engine ownership disjoint. Do not combine stack identity/GameState work with set-card, aggregate-picker, or opponent-decision edits.
- Check production dispatch, 0 selection, `owner=opp`, duplicate IDs, host/target leaves, AI/human parity, stale pending state, and base/P text equality.
- New UI decision flow requires Playwright. T3 requires RED→GREEN, Sol review, full gates, and CI.

## Gates

```powershell
npx tsc --noEmit
npx vitest run <focused probes>
npx vitest run
npm run docs:structure
git diff --check
```

- Add lint, smoke 1000, and Playwright according to risk.
- Record every shipment in reuse registry, memory, DEFERRED-INDEX, and session log.
- Re-estimate after each primitive; do not promise a combined 23-printing wave.
