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

## 2026-08-22: QA runtime Wave34 set-card lifecycle

- Wave34 certifies twelve same-answer QA across twenty-three printings and reaches 1218 matched/1746 test-missing. Public `handUseCard` proves host selection, face-up physical attachment, pre-leave retention, and host-leave removal. BUG-327 restores B02067/P's omitted red-character `charSetCard` line as `a0` while preserving shipped choose-intercept ID `a1`; B02067P now inherits the base mechanics. Horizontal scans found no other event CardDef with printed set text or on-set scope but no `charSetCard`.
- BUG-328 fixes duplicate B02067/P occurrences: each physical set card now owns its `turn1` use count, and its instance ID survives pending state, authority validation, dispatcher actions, JSON restore, and UI selection. Matrix and public-flow regressions cover B/B, P/P, mixed printings, character/event sources, repeat suppression, legacy backfill, and forged identity rejection.
- NEXT Wave35: generalize physical occurrence identity for triggered and declared `on-set-host` riders. Start with official adjudication and public RED probes for B01057/B05117/B07014/B10017; do not reuse host-level `declaredUseCount` without proving scene-only semantics.

## 2026-08-23: QA runtime Wave35 physical ability occurrences

- Wave35 certifies nine QA and reaches 1227 matched/1737 test-missing. B01057/P and B05117/P triggered riders plus B07014/P and B10017/P declared riders retain exact physical origin through engine, AI, replay, JSON, public UI, payment, and turn limits.
- BUG-329 makes legacy and malformed use counts fail-closed, rejects forged pending lineage, backfills AI legacy set-card IDs, preserves physical-UID PA-MR counters, and suppresses legacy leave hooks without an instance ID. Full serialized Vitest, smoke/baseline, focused desktop/mobile E2E, horizontal review, and three adversarial lenses pass.

## 2026-08-23: QA runtime Waves36-37 self-only evidence costs

- Waves36-37 certify twelve shared-Q&A case abilities and reach 1239 matched/1725 test-missing. Public dispatch proves incident/insufficient/overpayment rejection, exact-two self payment, opponent evidence isolation, transactional rejection, and turn-one repeat rejection.
- Independent review first BLOCKed self-only fixtures; asymmetric self/opp evidence and rejection snapshots cleared it. No production change. Full Vitest, smoke/baseline, representative desktop/mobile evidence-picker E2E, QA/docs gates, and review pass.
- NEXT Wave38: inspect the 35-card FILE(8) group (`questionHash 83f99d...`, `answerHash 9a850b...`) and prove whether an assisting partner counts through the public action/assist lifecycle before certifying any subgroup.

## 2026-08-23: QA runtime Waves38-39 assisted FILE counting

- Waves38-39 certify ten generic FILE(X) Q&A records and reach 1249 matched/1715 test-missing. Public assist plus continuous reads or hand entry proves threshold-minus-two stays off, threshold-minus-one plus partner activates, and a sufficient opponent FILE is ignored.
- Grounding corrects the prior label: the hash pair covers varied FILE4-8 thresholds, with 41 total QA, not only FILE8. Six were pre-matched; 25 remain after these waves. B07093's printed FILE7 a1 is still deferred.
- NEXT Wave40: public action lifecycle for B04068/B05108/D09016/D09017/PR289/PR295; keep action-declare and action-end timing distinct while sharing the assist threshold matrix.

## 2026-08-23: QA runtime Waves40-41 assisted FILE action/declared paths

- Waves40-41 certify eleven shared FILE(X) Q&A records and reach 1260 matched/1704 test-missing. Public assist now covers action-declare, action-end, declared rejection, costs, bound discard, stacked gate, source movement, and entry continuations with wrong-owner controls.
- Eleven pinned grounding decisions find no engine gap. B09010 removes an ordinary FILE card while the assisted partner remains; B10095 and D10011 preserve exact source cost movement.
- NEXT Wave42: remaining declared group B07069/B08004/B08007/B09055/B09060/PR179/PR185/PR199/PR205. Fourteen shared-Q&A records remain including deferred B07093 and four non-declared routes.

## 2026-08-23: QA runtime Waves42-43 assisted FILE remainder

- Waves42-43 certify thirteen QA and reach 1273 matched/1691 test-missing. Public paths now cover all implemented FILE(X) declarations, contact-removal observers, and cut-ins with transactionality, other-gate, timing, partner-preservation, and legal continuation controls.
- The exact FILE(X) pair is 40/41 matched. B07093 is the only remainder; current primitives support its a1, but append it after a2/a3 to preserve existing physical ability indices and old saves/replays.
- NEXT Wave44: implement/certify B07093 a1. NEXT Wave45 candidate: 12 Bond/partner-exclusion QAs (`d8ced3...` / `818541...`) across B05007/B05008/B05009/B05048/B05051/B05052/B05091/D10005/D10006/D10022/PR136/PR142.

## 2026-08-23: QA runtime Waves44-45 B07093 and Bond

- Wave44 completes B07093/P a1 as `[a2,a3,a1]`, preserving old occurrence indices. Public hand/remove, switch, enter, disguise, early leave, exact deck bottom, PA a2, JSON counts, and V1/V2 replay gates pass.
- Wave45 certifies twelve scene-only Bond records with partner-only negative controls and real declared, targeting, contact, end-turn, AP, LP, and keyword paths. Coverage reaches 1290 matched/1674 test-missing.
- NEXT Wave46: screen the 12-record `361a946b...` / `7efec64d...` group by exact official text and route before implementation. Backlog estimate: 140-260 uninterrupted agent hours.

## 2026-08-23: QA runtime Waves46-47 end phase and Investigation

- Wave46 certifies twelve end-phase activation records. BUG-330 adds one
  turn-owner/main-phase admission gate across reasoning, action, hand use,
  next hint, declared ability, and partner ability. Real end-turn paths prove
  no reuse before next self main, plus PA, PA-MR, optional, zero, and stun
  replacement branches.
- Wave47 certifies eight Investigation found-card records. BUG-331 exposes the
  exact Souza top-card occurrence set as public/all presentation, preserves
  defender reorder through JSON, and adds `reveal-to-bottom` so Souza/B08074
  never display a false shuffle. Central bottom-operation marking covers 140
  abilities, including six revealed-remainder randomizers; empty remainders use
  neutral `reveal-complete`. Coverage reaches 1310 matched/1654 missing.
- NEXT Wave48: route-screen `027580.../83d521...`, then
  `96d539.../47d3...` or `5a4907.../89083...`; split overlaps and mixed routes.

## 2026-08-23: QA runtime Waves48-49 action declaration timing

- Waves48-49 certify twelve same-ruling action triggers through distinct public
  routes. Target selection and actor sleep precede `action:declare`; direct AP,
  draw, Investigation, cut-in-ban, granted, pick, and simultaneous effects all
  settle before guard. Coverage reaches 1322 matched/1642 test-missing.
- BUG-332 joins state-owned human owner-order to public action-step admission.
  Guard/contact/advance/judge reject unchanged until set/resolveEffectOrder;
  AI already drains declaration effects before guard and remains unchanged.
- NEXT Wave50: ground and route-split `96d539.../47d3...`; do not reuse prior
  FILE/action tests without the exact QA assertion. Root AGENTS still says manual
  Ver2.4 while rules INDEX says Ver2.5; reconcile as a separate workflow change.
