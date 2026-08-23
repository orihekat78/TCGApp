# Next Task: QA adjudication Waves66-67

Resume `qa/adjudication-wave-20260814-13` after the Waves64-65 commit.

## Completed

- Wave64 certifies eight look-up-to-three short-deck records; B07066/P is the
  grounded horizontal correction.
- Wave65 certifies eight look-up-to-four short-deck records; B08071 and B10096
  are grounded horizontal corrections.
- BUG-339 repairs selected-card publication. BUG-340 repairs causal pending
  continuation authority and coherent legacy saves. BUG-341 corrects inherent
  sleeping entry and printed-ability identity for PR180/PR186.
- Coverage is 1447 matched / 1517 test-missing / 2964 total.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, `conan-router`, `card-wave`, and `conan-verify`.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-23-qa-waves64-65.md` and current QA trace.
4. Ground exact Q&A before classifying gaps. Do not infer absent rules.

## Wave66

- Question hash:
  `23630589318d3034e91553e3fd1d7fe2372aab7408010c8c5457caf6c90da611`
- Answer hash:
  `13dee71614f2c905921b2ddfef97bebc1511fd57bc103eea3684b5b242c6180c`
- Records and physical sources: B02021, B02045, B02060, B03013, B03127,
  D11014, D11021 (seven).

## Wave67

- Question hash:
  `24edb9585cfc938ed4545ee0dbd210da2b78764eb9b030ac0f725c35a1a71156`
- Answer hash:
  `dfc687d5bd704d90cfe7cb905e4b2580b1b16357c920715a87bc2ed21315563a`
- Records: B06013, B06043, B06065, B06095, B09111, B09112.
- Physical sources: B06013/P, B06043/P, B06065/P, B06095/P, B09111/P,
  B09112/P (twelve).

## Gates and stop

- Bind every physical source through public decisions; cover negatives, owner
  orientation, transactional rejection, persistence, and structural siblings.
- Run exact/focused tests, typecheck, ESLint, QA merge/lint, docs check, full
  functional Vitest, smoke1000, and representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after one or two implementation waves and write the next handoff.

Remaining estimate: about 1,517 records, roughly 129-278 agent hours before
future grouping gains; about 35-79 wall hours with four-way parallel work.
