# Next Session: Deferred Primitive Portfolio

## Current State

- branch: `main`; latest: `5466f27f docs(session): record parallel primitive lanes`.
- CL328 GitHub CI green: typecheck, full Vitest, lint chain, and smoke 1000: https://github.com/orihekat78/TCGApp/actions/runs/29242247994
- Integrated, uncommitted count: **2022 / 2074 printings; remaining 52**.
- Pending first CI: B06005/P, B08003/P, B08008 and B02067/P, B04003/P, B08081/P; all have Sol review and focused probes.
- B02022 `mustTargetSelfOnce` has Sol CLEAN approval. Case targeting and partner-action exceptions are probed.
- Exact existing-DSL/twin closures are exhausted. Do not plan a 20-printing no-engine batch.
- Uncommitted documentation update: CI checkpoint and next-session plan below.

## Start

1. Run `git status --short`; preserve session-preparation file unless intentionally committing documentation.
2. Read root/nested `AGENTS.md`, `.codex/context/current.md`, relevant rules, and `sessions/2026-07-13-2.md`.
3. Run `npm run ground -- <IDs>` before authoring. Four-cluster dossiers are in `.tmp/_ground/`.

## Portfolio

| Order | Primitive | Unlock | Risk |
|---|---|---:|---|
| 1 | stacked identity / host stack | B06005/P, B08003/P, B08008 = 5 | T3 |
| 2 | choose-intercept / negate / opponent decision | B02067/P, B04003/P, B08081/P = 6 | T3 |

## Execution Rules

- Aggregate multi-pick and self set-card remove->enter shipped. Start four isolated lanes: A stack identity, B hook/external ability, C picker/bind, E choose-intercept.
- Each lane owns its minimal engine slice, one representative card, and RED probes. Freeze shared contracts first. Main alone performs serial integration, Sol review, commits, registry/DEFERRED/memory/recount.
- Do not combine: intercept×picker, intercept×generic decision UI/AI, or stack×zone/self-reference. Keep stack/GameState work disjoint from picker and opponent-decision edits.
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

- New UI decision flow requires Playwright. T3 requires RED→GREEN and Sol review.
- GitHub CI runs exactly twice: after four-lane serial integration, then after all unlocked card additions. Do not push intermediate lane work to `main`.
- After representative primitives are integrated, add remaining unlocked cards/P variants/probes in parallel. Run the second CI only after that addition phase.
- Completion is optimistic, not promised: only declare complete at `2074/2074` after both CI checkpoints. New grounded primitive/UI/DSL gaps create a new lane.
