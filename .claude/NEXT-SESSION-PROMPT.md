# Next Session: Deferred Primitive Portfolio

## Current State

- branch: `main`; latest commit: `38579c02 feat(engine): integrate deferred decision primitives`.
- CI checkpoint 1 green: https://github.com/orihekat78/TCGApp/actions/runs/29252401237
- Local, uncommitted wave count: **2040 / 2074 printings; remaining 34**. Commit/push still pending.
- Latest wave: B01082, B06025, and B08059/P semantic completion (already registered); previous wave remains intact.
- Sol CLEAN; focused 100, full Vitest 5600, typecheck, smoke 1000, docs structure, and diff check green.
- Second CI remains reserved for final `2074/2074`; do not push this intermediate card wave.

## Start

1. Run `git status --short`; preserve session-preparation file unless intentionally committing documentation.
2. Read root/nested `AGENTS.md`, `.codex/context/current.md`, relevant rules, and `sessions/2026-07-13-2.md`.
3. Run `npm run ground -- <IDs>` before authoring. Re-triage the remaining 34; B01082, B06025, and B08059 are no longer candidates.

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
