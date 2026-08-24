# Next Task: batched QA adjudication Waves96-97

Resume `qa/adjudication-wave-20260814-13` after the Waves94-95 commit.

## Completed

- Wave94 certifies contact timing for B08038/D11007/D11008/PR304 and fixes
  role-relative bUid self triggers without changing observer event orientation.
- Wave95 certifies Hirameki decline for B07059/B07060/PR195/PR196/PR291/PR297.
- Coverage is 1634 matched / 1330 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves94-95 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes/routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: both typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Do not repeat a green unchanged gate.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves94-95.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Fetch required packages into an isolated temp
   root; never modify live `.claude/specs/cards-data`.

## Wave96 seed

- Exact tuple: section `1d1a726d51f8e15c5aad00c2f0ef4af5d5cbf3883a1c4ee178f7838c2035550a`,
  Q `708873564a225afb0c49c0b94049853f9df3855836cc0780378e8307bcdf297c`,
  A `cfea53ad6b2267f9b1f9d36ae4fbdd2c5a1cb60a016e329f4fc7b12b078cc33d`.
- Missing members: B06023, B07077, B08030.
- Ground first, then expand only adjacent rows sharing the exact primitive.

## Wave97 seed

- Exact tuple: section `200b0fb524390298f5ff5334ad6e2927a76937e2b0b4a455a353dc0da40cbe8b`,
  Q `306041e04ef53438a817902edbda910df98114d8b43a3e8350c12b61060a8fde`,
  A `cb4fe5abb0109aacfe807a5aa363432062f0fabb52e699154a3aada0c9710177`.
- Missing members: B10010, B10011, PR279.
- The same three cards have two adjacent three-member tuples in this section.
  Batch them only after fresh grounding proves one shared behavior matrix.

## Estimate

- Snapshot: 1330 remaining items / 1123 exact groups; 949 groups are singleton.
- Remaining QA work: 79-152 working hours; center estimate about 115 hours.
