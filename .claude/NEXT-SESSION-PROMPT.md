# Next Task: batched QA adjudication Waves114-115

Resume `qa/adjudication-wave-20260814-13` after the Waves112-113 commit.

## Completed

- Wave112 certifies ineffective Cut-In observer emission for five physical
  B03112/B03118/B09086 printings across both owners and contact roles.
- Wave113 certifies Misread 1 for D06015/PR027/PR031 across character/partner,
  accept/decline, LP1, cleanup, and zero controls.
- Coverage is 1697 matched / 1267 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves112-113 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes or routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Latest T3 gate is Waves106-107.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves112-113.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave114 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `3ec2b10d1e33547250313a3254c0eceb2146a642fa312844b2d9d54032a1e172`,
  A `d8cdbcf96cb81df73a04d13e77d97991d6dcaf5d6b1e012bc710edcd408f0a04`.
- Missing exact-group members: B01022, PR042, PR046.
- Ground all three members before changing adjudication.

## Wave115 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `45a11369ec9822986dcbcfab3dec24cc7867d83a37dfa78592e5fde74c8857be`,
  A `a59d427662d1ccb609694fffe240c6a21ead2cf3ad85ee7a2442755e68819ff2`.
- Missing exact-group members: B01007, B01088, D02013.
- Ground all three members before changing adjudication.

## Estimate

- Snapshot: 1267 remaining items / 1102 exact groups; 949 groups are singleton.
- Remaining QA work: 75-143 working hours; center estimate about 109 hours.
