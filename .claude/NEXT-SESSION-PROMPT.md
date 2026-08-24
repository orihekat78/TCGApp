# Next Task: QA adjudication Waves82-83

Resume `qa/adjudication-wave-20260814-13` after the Waves80-81 commit.

## Completed

- Wave80 certifies B02038, B02044, and B02086 across six physicals.
- Wave81 certifies B02043, B02045, B02047, and B03050.
- BUG-345 scopes B02047 immunity to one action. BUG-346 preserves replaced
  effective values. BUG-347 closes impossible empty-hand optional acceptance.
- Coverage is 1515 matched / 1449 test-missing / 2964 total.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves80-81.md` and current QA trace.
4. Fetch CT-P02/CT-P03 authority only into a new isolated `.tmp` root.

## Wave82

- Exact tuple: Q `ec58a8a7c7211d94959b85a007ced3e8c692c54c4a106fb92abebfe5c9660435`,
  A `aac3f501aac8a6f258c10970c01ed9a7ef08ae569ea2598c91183828a718d96a`,
  section `a7490cde656fdea72d6939329d372f44f8631dd88e1a4cbad59dbda0fd53bcb5`.
- QA suffix `9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48`.
- Exact members: B02038/P, B02041/P, B02043, B02044/P, B02045, B02047.
  Five records are test-missing; B02045 is the matched control.
- Ruling: a multicolor case containing white still satisfies 【事件（白）】.
- Prove public disguise gates for white-only, white+other, nonwhite, owner=`opp`,
  physical variants, riders, and atomic invalid rejection.

## Wave83

- Exact tuple: Q `a6d4bbd6170b3457e1cfb10f2f4f93681bd4e4d4645589023a949de6e7b8e1a2`,
  A `28c958b7b5f6584c1568157c061c38488d94b7fdb96d0d40b41138a65bd245b3`,
  section `0029d75498ecdbd0f5ec8a773acb521b538c42cfb00ee15631b9b02d68462f09`.
- QA suffix `bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6`.
- Exact members: B03050, B03051, B03052/P, B03129/P. Three records are
  test-missing; B03129 is the matched control.
- Ruling: disguise exchanges hand and scene characters, bottoms the old card,
  and preserves state, modifiers, and set cards under the replacement contract.
- Prove public valid/invalid exchange, owner orientation, inherited state and
  attachments, old-face deck order, observers, save where persistent, and all
  riders. Escalate to T3 if contact/GameState changes are required.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target record.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves82-83 and write the next handoff.

Remaining estimate: 1449 records, about 122-267 agent-hours or 33-74 wall
hours with four-way parallel work before future grouping gains.
