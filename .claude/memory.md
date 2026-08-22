# Session memory

## Prior records
- Engine adversarial: `.claude/sessions/2026-07-29-engine-adversarial.md`.
- Release/UI: `.claude/sessions/2026-08-14-qa-wave13-match-cost.md` and
  `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.
- QA engine/public evidence: `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`.
- Engine decisions 2026-08-15–16:
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA runtime Waves 17–26: `.claude/sessions/2026-08-22-qa-waves17-26.md`.

## 2026-08-22: QA runtime Waves27-30 public effect paths

- Waves27-29 certify 24 effect-entry QA; Wave29 fixes BUG-325 so B04030/P accept only printed `怪盗キッド`. Wave30 certifies 17 deck-look zero-choice QA, reaching 1175 matched/1789 test-missing: eligible-match decline, no hand add, mandatory tails, real public routes, and full cleanup. Adversarial review also fixes the sole same-shape B10068/B10101 leak: looked cards stay private; only a selected card is public. A 52-file/61-array cardName sweep found no alias recurrence.

## 2026-08-22: QA runtime Wave31 effect-entry enter triggers

- Wave31 certifies eight same-QA effect-entry paths across B03085/B06018/B06052/B06090/B09048/B09057/PR138/PR144, reaching 1183 matched/1781 test-missing. Real `handUseCard` routes prove the entered character's normal 【登場時】 trigger, causal order, filters, optional/zero branches, source movement, and cleanup without a production change. Horizontal scan identifies the remaining B01023/D10024 deck-look/set-card family as the highest-coherence Wave32 candidate; retain private look windows and asymmetric-host coverage.

## 2026-08-22: QA runtime Wave32 Shuffle Romance/contact host

- Wave32 certifies eleven QA and reaches 1194 matched/1770 test-missing. Twenty-five public-dispatch cases cover B01023/P and D10024 look/set/privacy/refresh branches plus legal guard, both contact participants, unrelated-observer negatives, and immediate contact termination when a start effect removes a participant. Exact-host `aUid`/`bUid` matching fixes opponent-caused contact on seven printings. RED probes exposed pre-effect AP freezing and missing-participant ordering; `contact-order-pending` now resumes after synchronous or human-paused `contact:start` effects, computes order from post-effect AP, or emits `contact:end` without an action window after participant removal.

## 2026-08-22: QA runtime Wave33 stacked-card semantics

- Wave33 certifies twelve QA across sixteen printings and reaches 1206 matched/1758 test-missing. Fourteen public-dispatch cases prove stacked cards are not scene characters and contribute only count: names, traits, colors, abilities, enter hooks, and leave hooks stay inactive. BUG-326 fixes `handStackUnder` so authoritative GameState preserves the revealed hand card ID through JSON and host departure instead of creating `back-card`. B08002 remains an independent manual-semantic identity because its answer hash differs from the shared question family. Horizontal scan found other physical stack paths already preserve IDs; legacy `{ uid, n }` remains count-only. Follow up separately on deterministic first-candidate stack costs and public stacked-card UI/replay visibility.
