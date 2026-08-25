# Next Task: card-completion QA Waves156-157

Resume `qa/adjudication-wave-20260814-13` after the Waves154-155 commit.

## Completed

- Wave154 finishes four B06046/P items for mandatory active-host Turn2 use,
  no-decline, hand-paid re-entry, and full-scene source switch.
- Wave155 ships B06047 filtered cross-hand level aura and finishes four items
  across ordinary hand use, Next Hint, two-source stacking, re-entry, and switch.
- Official YAIBA traits are restored for B06034 and white B06062-64 printings.
- Coverage is 1879 matched / 1085 test-missing / 2964 total; 962 exact groups
  remain, including 839 singleton groups.
- Fresh authority is 2257 printings and 2964 Q&A/zero conflict. PR322 remains
  outside the tracked 2256-printing snapshot.
- GameState/save shape is unchanged. Protected pnpm files remain untouched.

## Throughput contract

- Batch complete cards while keeping unrelated semantics in separate matrices.
- Per wave: grounded public proof and narrow QA merge only.
- Two-wave checkpoint: one type/lint/QA/docs/diff gate, one commit, one push.
- Waves154-155 ran fresh T3 full gates. Do not repeat unchanged broad gates
  inside Wave156; run them at the checkpoint only if T3 production changes.
- Certification-only work uses no agents. Production/T3 may reuse up to three
  read-only reviewers.

## Start

1. Read root/cards/tests AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read the Waves154-155 session record, this prompt, and QA workflow.
4. Re-run hash-only queue and fresh isolated authority validation.
5. Ground every physical printing before deciding certification versus repair.

## Wave156: complete B06049 and B06050/P

- B06049 target IDs: `1522823aa460aa0572f53f018bc39a9461f8b0b892d70825d15382c5c94a0818`
  and `68cb616e7037c15b43574cfef1c5f00ad25c53eb054ed185b99894700a81c0d3`.
- Certify that its enter-time YAIBA condition is a snapshot: failing at entry
  cannot become true later, and granted turn-scope `突撃` is not lost later.
- Existing source also ships action-scoped opponent Hirameki suppression. Treat
  old DEFER text as suspect; start with public proof before any engine edit.
- B06050 target IDs: `a0f94bba8509d4acfe102a31eb39dc8bcda03d5de444256e1a8f94f608eaf3e4`
  and `b0dedb9840a286bff2f817bbb1129574287876ab303fd5083762681f4170d8dc`.
- Base/P share mechanics. Certify one-of-two Cut-In choice and that the own-turn
  AP choice remains usable on the opponent turn but resolves to no effect.
- Its case-YAIBA icon explanation item is already matched.

## Wave157: complete B06052 and B06053/P

- B06052 target IDs: `7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79`
  and `ae7f52880f245b79ea26502eaca624f082c7777854d029f9cd6ca7c88b4fb8b4`.
- Certify immediate eligibility of the hand-paid YAIBA character and full-scene
  switch including the just-entered B06052. Its entrant-trigger item is matched.
- B06053/P target IDs: `789166124304989d9b4fa07711b90275986274798404b2ff8df9ee25725c552b`
  and `fd2c5177b466b8aa0ca13fefd957ad4642a0e177a3bb6bb2d792ae35ea5b579d`.
- Certify no-match whole-deck reveal returns/shuffles all cards without hand add,
  and the first matching YAIBA event is mandatory rather than declineable.

## Gate carry-forward

- Target/unit matrices: 3 files / 33 tests PASS.
- Full functional Vitest: 1229 files / 12920 tests PASS, 177 skipped.
- Typecheck, full ESLint, QA/docs/icon/card gates, smoke1000 PASS.
- Desktop/mobile human-vs-CPU Playwright 2/2 PASS, console error0.
- Sol rules/engine and final regression reviews PASS; findings remediated.

## Estimate

- Snapshot: 1085 remaining items / 962 exact groups; 839 singleton groups.
- Remaining QA work: 57-119 working hours; center about 89 hours.
- Risk-aware batching forecast: roughly 38-78 implementation waves.
