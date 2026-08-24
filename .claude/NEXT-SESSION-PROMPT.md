# Next Task: batched QA adjudication Waves86-87

Resume `qa/adjudication-wave-20260814-13` after the Waves84-85 commit.

## Completed

- Wave84 certifies five full-scene effect-entry gaps and reauthenticates
  B05062/B08029. BUG-350 fixes autonomous single/multi scene switching.
- Wave85 certifies five inherent-sleep gaps and reauthenticates B01011.
  BUG-349 fixes B01011/B01050/B01052/B03120 plus horizontal D06016.
- Coverage is 1533 matched / 1431 test-missing / 2964 total.
- Full T3 gates, Sol rules/engine review, smoke, and Playwright passed.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched.

## Throughput contract

- Do not create one wave per exact group. Batch 20-30 items that share one rule
  primitive into each ordinary implementation wave.
- Ordinary-wave gates: focused tests, both typechecks, focused ESLint, QA
  merge/lint, generated-Q&A check, and diff-check.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3 engine/save/UI
  changes, or before publication. Do not rerun unchanged green gates.
- Commit and push after the two implementation waves, then hand off.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves84-85.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Fetch only the required packages into an
   isolated non-live root; prefer OS temp under OneDrive rename pressure.

## Wave86 seed: event use by ability/effect

- Exact tuple: Q `b4840d0eb741d492a846155050620171b75c3effa6e08716e48ca8e80064c528`,
  A `ace28d47c654d454586320dc50a9b40679f9f442a52cd20d643581a497ebacce`,
  section `1d1a726d51f8e15c5aad00c2f0ef4af5d5cbf3883a1c4ee178f7838c2035550a`.
- Seed members: B03029 control; B07015, B08026, D10005, D10006, D10026 gaps.
- Ruling: an event used by a declared ability resolves like hand/Next Hint use,
  then reaches its printed destination; set effects can still set it.
- Expand the queue to 20-30 items sharing event-use authorization, FILE waiver,
  condition enforcement, destination, and event-used trigger semantics.

## Wave87 seed: Investigation count

- Exact tuple: Q `8edeb5c556cf559000c7672b9068af6d011764e07de9838f5c9c135417dbf521`,
  A `151f71e0f3fe880bba4086d745e94540f1546d2bed45fbe51037afd3a7c27ead`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Seed members: B01085 control; B01084, B01095, B02072, B03084, B03096 gaps.
- Ruling: the number immediately after `捜査` is the exact reveal count.
- Expand adjacent Investigation count/found-card/short-deck groups to 20-30
  items without mixing unrelated timing or ownership semantics.

## Estimate

- Snapshot: 1431 remaining items / 1182 exact groups; 990 groups are singleton.
- Expanded Waves86-87: 2-4 hours.
- All remaining QA work: 120-220 hours under the batched cadence.
