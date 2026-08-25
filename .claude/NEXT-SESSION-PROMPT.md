# Next Task: card-completion QA Waves160-161

Resume `qa/adjudication-wave-20260814-13` after the Waves158-159 commit.

## Completed

- Wave158 finishes B06057 event-use observer exclusions/mandatory draw and
  B06058 effective-LP0/reactivation-repeat rulings.
- Wave159 finishes twelve public rulings across B06062/P-B06064/P for optional
  leading targets, mandatory/no-host set behavior, short deck, rider stacking,
  and face-up set leave timing.
- All twelve items needed public tests/docs only; production source is unchanged.
- Coverage is 1899 matched / 1065 test-missing / 2964 total; 943 exact groups
  remain, including 821 singleton groups.
- Fresh authority is 2257 printings and 2964 Q&A/zero conflict. PR322 remains
  separate. Protected pnpm files remain untouched.

## Throughput and gate contract

- Batch complete cards; use separate matrices for unrelated semantics.
- Per wave: grounded public proof and narrow QA merge.
- Two-wave checkpoint: type/lint/QA/docs/diff, one commit, one push.
- This is the scheduled ten-wave checkpoint. After Waves160-161, run full
  functional Vitest, full ESLint, smoke1000/baseline, and desktop/mobile
  human-vs-CPU Playwright even if production remains unchanged.
- Certification-only work uses no agents. Production/T3 may reuse up to three
  read-only reviewers.

## Start

1. Read root/cards/tests AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read the Waves158-159 session record, this prompt, and QA workflow.
4. Re-run hash-only queue and fresh isolated authority validation.
5. Ground every physical printing before certification or repair.

## Wave160: B06060, B06067/P, B06071/P, B06072/P

- B06060 target: `2ca5b478df684d0944e74fceb7664125a59a6e2a239ae9323d3477e04506cf07`.
  Certify reactivated YAIBA may reason/action again; its stunned result is matched.
- B06067 targets: `216635e95c72a51ec62eae36e6d454a46acedc98cc0a2a21ba43330df5ea5cdc`
  and `42704e74cdc71bbd20cccec5539d9b54f9235cd9a16e556a7bc2c6da0c4f8fda`.
  Certify all physical observers fire mandatorily, plus self-selection; granting
  active-target authority alone does not bypass same-turn named-state action ban.
- B06071 target: `cb8dae30a14a64f9d6492d1cca938382df2537937250eb97dca078a642423626`.
  Certify its all-sleeping stun is non-targeting and affects untargetable chars.
- B06072 targets: `6fc795f4f30ade615b73f19c92634e279b3660340b23a3cdba5eeb034199985d`,
  `f9a68a53b3f56507b27132d0bf80e22da4efe49d79c91138658d9a6fe43eebb2`,
  `22be40f06dc558d4dde620e44fe198bf395c34480c4c217a4958a229a718d83e`.
  Certify color-ignore hand/Next Hint use, the 14-or-less branch, and transition
  into the 15-plus sequence after the low branch increases YAIBA remove count.

## Wave161: B06076, B06077/P, B06085/P, B06086/P

- B06076 target: `2bcbc572704a40c4bd313efcdb48dc88426ff84922e2c41ac0fcde537aec79ab`.
  Certify its declared ability is usable in incident phase; resolved condition
  belongs only to the enter ability.
- B06077 target: `65dd2c7e49e2adf37709417f08fbadb4f39726eb883e81d8d5c811220ad32722`.
  Certify action-end ability still fires when the opposing contact character
  leaves but B06077 itself remains.
- B06085 targets: `d1c94c78592eadb05a3dffd93557a2e630046e03a30c05d4326e2b09a1664141`,
  `1b0a91fc4f7f6848d183ec4bdbb062fb4d26144fe32b0459fe99f07ec54fcc64`,
  `8b2afa65e94bc9030fd142d29d8351670cafb8e77bb5f4dbd3ddf286dc486e3b`.
  Public declared flow: arbitrary evidence position/top insertion, MR scene-to-
  evidence redirect into partner area, and independent 0..1 choices.
- B06086 targets: `7e995814959f1317d5d3a0209d1a4fe2bdd07f8bce570f7d1491700501592010`,
  `c84d7aad4528fd6d980afa11b31629dd80c57a9c461526f6b41e76abb0604128`,
  `c609f7a1a0c521302172c1f974c7bd0f428812c87dbbe14e019da0d62c3a0c72`.
  Certify pre-guard timing, mandatory available evidence flips with no AP bonus
  unless both sides flip, and arbitrary face-down evidence positions.

## Gate carry-forward

- Target public matrices: 2 files / 49 tests PASS.
- Focused horizontal: 14 files / 251 tests PASS.
- Both TypeScript projects, scoped ESLint, QA/docs/icon/card gates PASS.
- Last broad gate: Waves154-155 full Vitest 1229 files /12920 tests,
  smoke1000, full ESLint, desktop/mobile Playwright 2/2.

## Estimate

- Snapshot: 1065 remaining items / 943 exact groups; 821 singleton groups.
- Remaining work: 54-115 hours, center about 85; roughly 34-74 waves.
