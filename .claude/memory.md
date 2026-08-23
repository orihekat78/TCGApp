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

## Next

- Wave52 route-screens `2aa7bfa6.../18ed0c93...`: effect-entered characters
  resolve normal enter abilities. Twenty records have mixed public routes.
- Secondary: nine exact-two evidence-cost records at
  `a0f512e6.../dbbcc5c6...`.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
