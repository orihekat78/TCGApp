# Next Task: QA adjudication Waves62-63

Resume `qa/adjudication-wave-20260814-13` after the Waves60-61 commit.

## Completed

- Wave60 certifies seven stun-definition records across eight physical sources.
- Wave61 certifies seven full-scene effect-entry records across thirteen physical
  sources, including source-self switch, nested enter hooks, owner symmetry, and
  transactional forged-victim rejection.
- Coverage is 1414 matched / 1550 test-missing / 2964 total.
- No production or CardDef change was required.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, `conan-router`, `card-wave`, and `conan-verify`.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-23-qa-waves60-61.md` and current QA trace.
4. Ground exact Q&A before classifying gaps. Do not infer absent rules.

## Wave62: largest remaining exact group

- Question hash:
  `f70dca6d863c38348fdcedfafa0431d49b150f39c4ad5f90e4dd2d9b641db2d6`
- Answer hash:
  `b827971d951f9835d6c0840bd8d55b1b515112a015ed2bc51e5ec3b110f772b1`
- Records: B08033, B08034, B08035, B10021, B10022, B10023, B10026,
  B10027, B10040.
- Physical sources: B08033/P, B08034/P, B08035, B10021/P, B10022/P,
  B10023/P, B10026/P, B10027/P, B10040.

## Wave63: next largest exact group

- Question hash:
  `5594be19e41fbe1cb70124f3ccc6258a69b9f9801326e96045000df8c95df77c`
- Answer hash:
  `b224b606f8fc34f02bcbd2792e156388486d6469c478c49a07fe2816784668c6`
- Records: B05055, B05056, B07020, B07037, B07082, B08056, B08083,
  B09109.
- Physical sources: B05055, B05056, B07020/P, B07037, B07082/P,
  B08056, B08083, B09109/P.

## Gates and stop

- Bind every physical source through public decisions; cover negatives, owner
  orientation, transactional rejection, persistence, and structural siblings.
- Run exact/focused tests, typecheck, ESLint, QA merge/lint, docs check, full
  functional Vitest, smoke1000, and representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after one or two implementation waves and write the next handoff.

Remaining estimate: about 1,550 records, roughly 132-284 agent hours before
future grouping gains.
