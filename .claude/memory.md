# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-26: `.claude/sessions/2026-08-22-qa-waves17-26.md`.
- QA Waves27-34 rotation:
  `.claude/sessions/2026-08-23-qa-memory-waves27-34.md`.
- QA Wave35 and Waves36-49: matching dated files under `.claude/sessions/`.

## Recent QA decisions

- Waves44-45 add B07093 a1 without changing prior ability indices and certify
  twelve scene-only Bond records.
- Waves46-47 certify end-phase and Investigation paths. BUG-330 gates main
  actions by turn/phase. BUG-331 publishes exact Souza discoveries without a
  false shuffle presentation.
- Waves48-49 certify action-declare timing. Target selection and actor sleep
  precede triggers; all declaration effects resolve before guard. BUG-332 joins
  state-owned owner-order to public action-step admission.

## 2026-08-23: QA runtime Waves50-51

- Wave50 certifies ten records proving `stackedCards` are never `setCards`.
  All real public stack routes assert `setCards=[]`; B09048 gains its missing
  declared-cost public route.
- Wave51 certifies ten deck-look refresh records, including B08050
  recertification. Viewed cards stay in deck until the remainder-to-remove
  checkpoint; deck sizes 1/2/3 and decline are public-tested.
- BUG-333 corrects 23 descriptors with `deferRefresh`/`refreshAfter`; B09078 and
  B07015 now refresh before conditional discard. A runtime invariant covers all
  24 shipped look-hand-remove descriptors.
- BUG-334 resolves multi-pick decline once and prevents end-turn transition from
  overtaking held deck-reveal continuation. Human and no-human B09078 plus real
  B10097 partner-area end paths pass.
- Coverage after generation should be 1341 matched / 1623 test-missing.

## 2026-08-23: QA runtime Waves52-53

- Wave52 grounds all twenty remaining effect-entry records, then repairs the
  three real CardDef gaps: B06047, B08083, and B09007/P.
- Their public routes bind the actual source and prove the chosen entrant's own
  normal enter ability. B06047's unsupported cross-hand aura stays fail-closed.
- Wave53 certifies nine declared abilities whose cost is exactly two face-down
  evidence. Mixed-state rejection is transactional; a later nonadjacent valid
  selection succeeds in the same turn without using opponent evidence.
- Coverage after generation should be 1353 matched / 1611 test-missing.

## Next

- Wave54: B03062, B04090, B05015, B05077, B06012, B06046, B08076, B09106,
  and B10095 direct/linear effect-entry routes.
- Wave55: B06087, B09056, B10023, D10023, PR173, PR280, PR291, and PR297
  nested, Bond, and clone routes.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
