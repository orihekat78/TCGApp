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

## 2026-08-23: QA runtime Waves54-55

- Wave54 certifies nine direct/linear effect-entry records; Wave55 certifies
  eight nested, contact, clone, and partner-area sources.
- BUG-336 restores B09056/P's printed trace choice. Inapplicable options remain
  human-selectable no-ops; autonomous resolution skips only conditionals known
  false without `else` and does not surface opponent-owned choices to the human.
- Physical source identity is public-tested for D10023/PR173 and PR291/PR297.
- Coverage after generation should be 1370 matched / 1594 test-missing.

## 2026-08-23: QA runtime Waves56-57

- Wave56 certifies eight disguise-definition records through real contact.
  State, name, modifiers, gained keywords, set cards, and stacked occurrences
  transfer; old faces reach deck bottom without entry/removal hooks.
- BUG-337 blocks a second `actionContact` in the same acted slot. Immediate
  cut-in-to-disguise and disguise-to-cut-in public redispatch now reject.
- Wave57 certifies eight arbitrary-position exact-two evidence records across
  fifteen physical case printings. `[3,0]` preserves identity, origin, order,
  length, and opponent evidence; five malformed classes reject transactionally.
- Coverage after generation should be 1386 matched / 1578 test-missing.

## Next

- Wave58: seven self-only hand-remove cost records at `03c52f9b.../45979cb6...`.
- Wave59: seven self-only deck-top-three remove records at
  `d6e909a1.../45979cb6...`; preserve each card's post-cost effect sentinel.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
