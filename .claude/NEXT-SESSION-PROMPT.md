# Next Task: QA adjudication Waves64-65

Resume `qa/adjudication-wave-20260814-13` after the Waves62-63 commit.

## Completed

- Wave62 certifies nine face-down set-card privacy records across sixteen
  physical sources, including replay/UI redaction and post-removal disclosure.
- Wave63 certifies eight full-scene effect-entry records across eleven physical
  sources, including source-self switch, exact tails, and zero-entry routes.
- BUG-338 corrects B08034/P rarity from C/CP to official R/RP.
- Coverage is 1431 matched / 1533 test-missing / 2964 total.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, `conan-router`, `card-wave`, and `conan-verify`.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-23-qa-waves62-63.md` and current QA trace.
4. Ground exact Q&A before classifying gaps. Do not infer absent rules.

## Wave64: largest remaining exact group

- Question hash:
  `c2a2f4725a401741570b95f9e5d006dd5bc4a10c5a40373e903f18cb0cac1639`
- Answer hash:
  `fec16cedeb8683f39fe7ddc9a70fab0a14e5c9217502735c4556a1b181870065`
- Records: B06013, B06043, B06088, B08016, B08024, B08094, PR180, PR186.
- Physical sources: B06013/P, B06043/P, B06088, B08016, B08024,
  B08094/P, PR180, PR186.

## Wave65: next largest exact group

- Question hash:
  `e3bbd8156841a3aa724da9e2ab9b83bec0015916162b53d294a97a12fb4b3c90`
- Answer hash:
  `fec16cedeb8683f39fe7ddc9a70fab0a14e5c9217502735c4556a1b181870065`
- Records: B07073, B08020, B08075, B09074, B10010, B10039, B10054,
  B10101.
- Physical sources: B07073/P, B08020/P, B08075/P, B09074/P/P2, B10010,
  B10039/P, B10054/P, B10101/P.

## Gates and stop

- Bind every physical source through public decisions; cover negatives, owner
  orientation, transactional rejection, persistence, and structural siblings.
- Run exact/focused tests, typecheck, ESLint, QA merge/lint, docs check, full
  functional Vitest, smoke1000, and representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after one or two implementation waves and write the next handoff.

Remaining estimate: about 1,533 records, roughly 130-281 agent hours before
future grouping gains.
