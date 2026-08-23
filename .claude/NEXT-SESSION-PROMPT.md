# Next Task: QA adjudication Waves70-71

Resume qa/adjudication-wave-20260814-13 after the Waves68-69 commit.

## Completed

- Wave68 certifies six exact-three owner-cost records; B05063 remains the
  aligned horizontal member. Thirteen physical printings are public-path bound.
- Wave69 certifies six Event YAIBA records across eleven physical printings.
  BUG-342 and BUG-343 are fixed with Sol rules/engine PASS.
- Coverage is 1472 matched / 1492 test-missing / 2964 total.
- Existing untracked pnpm-lock.yaml and pnpm-workspace.yaml stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read .claude/sessions/2026-08-24-qa-waves68-69.md and current QA trace.
4. Fetch current official source for CT-P05/P06/P07/P08/D08/D09 before binding.

## Wave70

- Question hash:
  df623fb6fab6a794407d5c27f0951036cafa3c3d2c5922474e0492195332d20a
- Answer hash:
  1f9dea222899252685faff65ee3a04b23d7ec4a0bc5637f27004c075dc0a5485
- Exact Q&A: with two or fewer facedown own evidence, flipping all of them does
  not pay an exact-three declared cost; the ability cannot be used.
- Records: B05024, B05063, B05083, B06036, B06105, D09027.
- Physical sources: B05024/P, B05063/P, B05083/P, B06036/P, B06105/P,
  D09027 (eleven).
- Reuse Wave68's short-owner transactional negative only after adding exact
  Wave70 card-bound QA comments/evidence and fresh authority grounding.

## Wave71

- Question hash:
  628a61f1e0071ea8bf82ff81e4c18cd6148f60c6bdfcfd0c548c4861d3efc7fc
- Answer hash:
  45979cb61275514a31c0e89b0df5a48215e8c3e34e6e49457a0a2c82fd481c80
- Exact Q&A: a colon-left cost that flips one facedown evidence cannot use the
  opponent's evidence; only the ability owner's cards may pay.
- Records: B07061, B07077, B08030, B08044, D08005, D08006.
- Physical sources: B07061/P, B07077/P, B08030/P, B08044/P, D08005, D08006
  (ten).

## Gates and stop

- Cover every physical source, owner=`opp`, arbitrary position, malformed
  selections, transactional rejection, persistence, CPU, and siblings.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves70-71 and write the next handoff.

Remaining estimate: about 1,492 records, roughly 127-274 agent hours or 33-77
wall hours with four-way parallel work before future grouping gains.
