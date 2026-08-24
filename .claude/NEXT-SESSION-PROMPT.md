# Next Task: QA adjudication Waves84-85

Resume `qa/adjudication-wave-20260814-13` after the Waves82-83 commit.

## Completed

- Wave82 certifies five multicolor-case gaps and reauthenticates B02045.
- Wave83 certifies B03050/B03051/B03052 and reauthenticates B03129.
- BUG-348 ends contact after either participant leaves and orders contact:end
  effects before action:end across public UI, AI, save, and sibling consumers.
- Coverage is 1523 matched / 1441 test-missing / 2964 total.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves82-83.md` and current QA trace.
4. Fetch only required packages into an isolated non-live root. Prefer OS temp
   if OneDrive rejects the worktree `.tmp` atomic staging rename.

## Wave84

- Exact tuple: Q `5594be19e41fbe1cb70124f3ccc6258a69b9f9801326e96045000df8c95df77c`,
  A `b79af84d1269cf62ae85ac95d41ce067c3c3dd661890d73e47e4fb451572fe70`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- QA suffix `f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398`.
- Members: B05062 control; B07090/P gap; B08029/P control; D08024, D09025,
  PR291, and PR297 gaps. Five gaps across nine physicals.
- Ruling: with five scene characters, an effect may still enter a character by
  removing one own scene character as a switch.
- Prove public full-scene candidate selection, physical identity, source/self
  switch eligibility, cancel/invalid atomicity, owner, save, CPU, and riders.
- Authority packages: CT-P05/P07/P08, CT-D08/D09, and PR-01 event data.

## Wave85

- Exact tuple: Q `3e07603cb3f289f43354d143cf804703fb8ac01bb708bcf74c8ab310405eead2`,
  A `1b2c898e067f3d339db0b91e7d5aaa953bcb98174c1eb0361d7bb21519cd549a`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- QA suffix `b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce`.
- Members: B01011 control; B01050, B01052, B03120, PR180, and PR186 gaps.
- Ruling: a printed sleep-entry instruction remains sleep entry when the
  character enters by an ability or effect.
- Prove direct effect entry, trigger timing/state visible to external enter
  observers, owner, switch-at-capacity, save/CPU, and physical source identity.
- Authority packages: CT-P01, CT-P03, and PR-01 character data.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target/control.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves84-85 and write the next handoff.

Remaining estimate: 1441 records, about 121-266 agent-hours or 33-74 wall
hours with four-way parallel work before future grouping gains.
