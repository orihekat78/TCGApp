# Next Task: card-completion QA Waves158-159

Resume `qa/adjudication-wave-20260814-13` after the Waves156-157 commit.

## Completed

- Wave156 finishes B06049 entry-snapshot persistence and B06050/P Cut-In choice
  plus off-turn no-op. The stale B06049 suppression DEFER is closed.
- Wave157 finishes B06052 hand-paid re-entry/source switch and B06053/P forced
  first-match/no-match whole-deck reveal behavior.
- All eight items needed public tests/docs only; production source is unchanged.
- Coverage is 1887 matched / 1077 test-missing / 2964 total; 954 exact groups
  remain, including 831 singleton groups.
- Fresh authority is 2257 printings and 2964 Q&A/zero conflict. PR322 remains
  outside the tracked 2256-printing snapshot.
- Protected pnpm files remain untouched.

## Throughput contract

- Batch complete cards while keeping unrelated semantics in separate matrices.
- Per wave: grounded public proof and narrow QA merge only.
- Two-wave checkpoint: one type/lint/QA/docs/diff gate, one commit, one push.
- Waves154-155 ran fresh T3 broad gates. Waves156-157 were certification-only.
- Do not repeat broad gates during Wave158. If Wave159 remains certification,
  defer the scheduled ten-wave broad gate to the Wave160 checkpoint.
- Certification-only work uses no agents. Production/T3 may reuse up to three
  read-only reviewers.

## Start

1. Read root/cards/tests AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read the Waves156-157 session record, this prompt, and QA workflow.
4. Re-run hash-only queue and fresh isolated authority validation.
5. Ground every physical printing before deciding certification versus repair.

## Wave158: complete B06057 and B06058

- B06057 target IDs:
  `9cf96476126c1e8f61997b00d847da85ab81c2d0e6281421a481b755b35ea73e`
  and `6ef75028554fc17862ec6d9114267258f52ac2a1d278a1c7fb0e61edc0d1d265`.
- Certify that white YAIBA Cut-In/Hirameki use does not trigger its event-use
  observer, while a qualifying ordinary event use mandates the draw.
- The same-card multi-source/Turn1 item is already matched.
- B06058 target IDs:
  `6881f15695286303edf5b552916dd1faca5e8acc0930bbfc54bd149171acded3`
  and `b0f3eacc47c4c656dfb430f1965f826fcdbdad6f064df0c1803663d0a16f2761`.
- Certify target LP at resolution time, including modified positive/negative LP,
  and that a reactivated character may reason/action again when otherwise legal.
- Its stunned-activation item is already matched.

## Wave159: complete B06062/P, B06063/P, and B06064/P

- B06062 target IDs: `0006b174016834d6e10769372f487ca740771f9f2b3e55d0e6b52a5c209b5c43`,
  `3dcf957ce25b0100aab930e1cebdfa5824f5183eeddce6011d5699be765a5abf`,
  `a7cc984fb0e3691d53ce48afdd3ec2c50043b1d60db08868a02838de17cad3d9`.
- B06063 target IDs: `34f593b081269e7230603c6ba41bfb30204234c76224753da06ad06d4b837741`,
  `3dcf957ce25b0100aab930e1cebdfa5824f5183eeddce6011d5699be765a5abf`,
  `93d5ba8c720b073b1770d6a26e5c3009e28b78112854e92e612b7fd29ac9ec3d`.
- B06064 target IDs: `3dcf957ce25b0100aab930e1cebdfa5824f5183eeddce6011d5699be765a5abf`
  and `9b6d433b1185b735c64098d872b9750e01d22ef63df05b842c3b6da49181e104`.
- Share one public set-event matrix: optional leading target may be zero; no-host
  use remains legal; a valid host makes setting mandatory; Base/P are twins.
- Add card-specific tails: B06062 short-deck mill/refresh, B06063 two-copy AP
  stacking, and B06064 face-up set leave timing. Already-matched set lifecycle,
  face-down no-trigger, and entrant-trigger items must remain green.

## Gate carry-forward

- Target public matrices: 2 files / 24 tests PASS.
- Focused horizontal: 11 files / 183 tests PASS.
- Both TypeScript projects, scoped ESLint, QA/docs/icon/card gates PASS.
- Last broad gate remains Waves154-155: full Vitest 1229 files /12920 tests,
  smoke1000, full ESLint, desktop/mobile Playwright 2/2.

## Estimate

- Snapshot: 1077 remaining items / 954 exact groups; 831 singleton groups.
- Remaining QA work: 56-117 working hours; center about 87 hours.
- Risk-aware batching forecast: roughly 36-76 implementation waves.
