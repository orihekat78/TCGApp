# Session memory

## Prior records
- Engine adversarial: `.claude/sessions/2026-07-29-engine-adversarial.md`.
- Release/UI: `.claude/sessions/2026-08-14-qa-wave13-match-cost.md` and
  `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.
- QA engine/public evidence: `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`.
- Engine decisions 2026-08-15–16:
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.

## 2026-08-21: Effect entry and after-sleep closure
- d8dc public coverage now certifies B02077/B03049/B04084/B05062/B09047 through entered-character trigger and cleanup.
- Exact 「推理かアクションしたとき」 family uses `reasoning:after-sleep`; B02004 variants share the base definition.
- If an after-sleep effect removes the reasoner, cancel its continuation and causal trace before evidence; keep wrong-player/non-sleep throws.
- B05062 is white; its four-card count has no level cap, while the reanimate target remains level 7 or lower.

## 2026-08-21: QA runtime Waves17-21
- Wave17 owner-order certifies 24; production `enter` has `uid`, so B02088/B09003 use `payloadKey:'uid'`.
- B07063 grants use base/`#N` IDs; B04003 still loses a copy through `choose-intercept`, then regress B08081/P and B02067.
- Wave18 public reasoning plus decision certifies 33 actual Misread cards; no production change; coverage is 949 matched/2015 test-missing. Promos and BUG-319 remain excluded.
- Wave19 certifies 10 Shippu QA; Wave20 certifies 14 face-down-set QA; Wave21 certifies 21 Bond-partner exclusions across 30 printings. B04003/P use a scene-target-implied Bond; coverage is 994 matched/1970 test-missing.

## 2026-08-21: QA runtime Wave22 and optional sequence order
- Wave22 certifies 24 active-on-stun QA across 36 printings; coverage is
  1018 matched/1946 test-missing.
- Applying active to stun removes stun and leaves the character sleep.
- Sequence prewalk must stop at the first human optional and append its tail as
  state-owned continuation; B08075 fixes flat and nested decision order.
- Probe generation treats optional decline as skipping only the optional body,
  then scripts later sequence prompts; B03080 is the horizontal regression.
- Gates: focused 89/89, full Vitest 10386/10386, typecheck/lint/docs/QA/build,
  smoke 1000, public full-match Playwright, and engine/test reviews pass.
- Wave23 should audit choice symmetry, persistence, and public UI integration.

## 2026-08-21: QA runtime Wave23 decision persistence
- Wave23 certifies 31 decision/continuation QA across 20 printings; coverage is
  1049 matched/1915 test-missing.
- Persisted decisions always surface; one public driver resolves a non-human
  owner through authority-bound actions while the first human decision blocks later work.
- `App` and `RealMatchView` each own one replay-gated decision driver; shared
  `Playmat` owns none, and tutorial/replay compositions pass `replayReadOnly`.
- `stepTurn` activates its supplied GameState before ambient runtime reads;
  markerless new channels remain live, but marker-owned foreign caches are cleared.
- Choice continuations append sibling tails instead of replacing nested work;
  file mutation handles both Immer drafts and plain restored arrays.
- B07013 requires an active Conan; B10060 opens child decisions only after an
  actual entry. RPS, set-card, reorder, placement, and replacement use the same owner boundary.
- Final clean gates: release preparation 1/1 and full Vitest 10438/10438 pass;
  Sol engine and Terra test reviews report no BLOCK.

## 2026-08-21: QA runtime Wave24 sleep-cost authority
- Wave24 certifies 24 declared sleep-cost and related-entry QA; coverage is
  1073 matched/1891 test-missing.
- Cost DSL `self`/`opp` sides resolve relative to the source controller;
  B06078 exposed fixed-`self` deck payment for opponent-owned sources.
- `removeDeckTop` can-pay/dry/live and horizontal `removeDeckAll` dry/live paths
  share the controller-relative resolver.
- Explicit payer tests reject forged, foreign, sleeping, stunned, excluded,
  and filter-decoy UIDs atomically while preserving exact valid selection.
- Entry/continuation coverage closes B07002, B07016, B07067, and B09058;
  Sol engine and Terra test reviews report no BLOCK.
- Final clean gates: release preparation file 1/1 (113 passed, 1 skipped) and
  full Vitest 1096 files/10471 tests pass (3 files/178 tests skipped).

## 2026-08-21: QA runtime Wave25 immediate reactions and effect entry
- Wave25 certifies 27 QA across B08058/B08081/B10071/B10087/B10088; coverage is
  1100 matched/1864 test-missing.
- Choose-intercept freezes every mandatory same-timing physical copy, lets the
  ability owner order them, and consumes each turn limit independently.
- Any cancellation stops only the original selecting effect; already-triggered
  siblings still resolve. The source resumes once after all payments, otherwise zero.
- Physical batch witnesses bind the exact ordered selected UIDs and cancellation;
  add/delete/duplicate/reorder/flag forgeries reject transactionally after restore.
- A B02067-first mixed batch drains three payments, emits one terminal causal cancel,
  produces no source sleep/draw/summary, and clears every physical witness.
- B10088 defers full-scene switching after remove selection; short decks stay inert,
  and the chosen removed character emits its effect-entry hook.
- `cutin:used` carries the declared batch so B10087 observes the current cut-in
  before the batch is consumed; B04003/B08081 physical-copy ordering remains covered.

## 2026-08-22: QA runtime Wave26 Misread authority and atomic reactions
- Wave26 certifies 34 Misread QA; coverage is 1134 matched/1830 test-missing.
- A public Misread decision needs both exact GameState fields and its nonserialized,
  process-local live lease; owner, reasoner, candidates, token, trace, runtime object
  identity, and a graph-aware typed snapshot of the finalized pause-time full GameState must match.
  JSON/replay, cross-session restore, shared-runtime UID aliases, non-finite number aliases,
  unsupported descriptors, cycles, changed object aliases, and semantic state edits fail closed.
- Side-channel data is projection, never authority. Forged, cloned, stale, foreign,
  reordered, duplicated, or replayed selections reject transactionally.
- Multi-Misread commits every sleep and the aggregate LP reduction before emitting
  one `misread:performed` event per physical UID; B05015 sees the full committed state.
- Terminal, replay, and transient-runtime boundaries clear the authority.
- Same-owner hydration rechecks Misread before its runtime-marker fast path, while
  other live decisions retain their valid pre-snapshot transitions (notably Hirameki).
- PR247 generic Misread evidence is aligned; bundled PR247/PR262/PR268 QA remains
  test-missing where the additional printed effect is not completely proved.
- BUG-323 records B09016's separate trigger-time versus resolution-time condition defect.
## 2026-08-22: QA runtime Waves27-30 public effect paths

- Waves27-29 certify 24 effect-entry QA; Wave29 fixes BUG-325 so B04030/P accept only printed `怪盗キッド`. Wave30 certifies 17 deck-look zero-choice QA, reaching 1175 matched/1789 test-missing: eligible-match decline, no hand add, mandatory tails, real public routes, and full cleanup. Adversarial review also fixes the sole same-shape B10068/B10101 leak: looked cards stay private; only a selected card is public. A 52-file/61-array cardName sweep found no alias recurrence.
