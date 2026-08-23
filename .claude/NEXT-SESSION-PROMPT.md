# Next Task: QA adjudication Wave46

Resume from `qa/adjudication-wave-20260814-13` after the Waves44-45 commit.

## Completed

- Wave44 implements/certifies all five B07093 Q&As.
- B07093/P abilities are intentionally `[a2,a3,a1]`; old a2/a3 indices stay 0/1.
- V1/V2 exact and witness-free replay, PA-MR a2, public disguise, and early leave pass.
- Wave45 certifies twelve Bond rulings with partner-only negative controls.
- Coverage is 1290 matched and 1674 test-missing.

## Fresh evidence

- Focused horizontal: 8 files / 103 tests pass.
- Wave44: 21 tests; Wave45: 12 tests; all review lenses pass.
- Full Vitest, smoke, lint, docs, QA, and representative E2E evidence are in
  `.claude/sessions/2026-08-23-qa-waves44-45.md`.

## Start Wave46

1. Confirm branch, HEAD, upstream, and status without stash/reset/clean/checkout.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
3. Ground exact group:
   - question `361a946b4b92ff63d36dd4d0f4a6e9f8c5891a025ea3e96c0b5cf9a81f659aee`
   - answer `7efec64def765e211d0d7cddba25d5b455bf9dfe8b4dfc89d1acf7677721e475`
4. Q: can an end-turn-activated character reason/action again?
   A: no; the ability resolves in end phase, after main-phase actions.
5. Safe public end-phase cohort:
   `B07023,B07072,B07088,B08015,B08073,B09049,B09065,B10036,B10045,B10067`.
6. Prove positive activation, then prove no main-phase action is possible before
   the next self turn. Include stunned-target => sleep and zero-target controls.
7. Include optional/self-removal controls for B07023/B07072 and optional
   self-sleep controls for B09049/B09065.
8. Do not certify unrelated abilities on B08073/B10045/B10067.
9. Keep these two records separate until their structural gaps are adjudicated:
   - B07045: partner-area non-partner Big Jewel enumeration.
   - B09002: partner-area MR activation / missing structural slot predicate.
10. After Wave46, select the next coherent hash group; hash equality alone is
    not proof of one public route.
11. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves44-45.md`
- `.claude/changelog-entries/2026-08-23-10-qa-wave44-b07093-a1.md`
- `.claude/changelog-entries/2026-08-23-11-qa-wave45-bond-partner-exclusion.md`

Remaining estimate: 1674 records / 1138 exact hash groups / 880 singleton groups,
or roughly 140-260 hours of uninterrupted agent execution.
