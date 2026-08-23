# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-26: `.claude/sessions/2026-08-22-qa-waves17-26.md`.
- QA Waves27-34 rotation:
  `.claude/sessions/2026-08-23-qa-memory-waves27-34.md`.
- QA Wave35 and Waves36-49: matching dated files under `.claude/sessions/`.

## QA campaign history

- Waves35-49 are recorded in matching dated session files. They cover physical
  ability identity, Bond, end phase, Investigation, FILE assist, and action timing.

## 2026-08-23: QA runtime Waves50-51

- Wave50 separates stacked cards from set cards. Wave51 certifies deck-look
  refresh timing. BUG-333/334 fix refresh attribution and held continuation.

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

## 2026-08-23: QA runtime Waves58-59

- Wave58 certifies seven owner-only one-card hand costs across ten physical
  sources. Opponent-shaped, malformed, and unavailable-sleep payments are atomic.
- Wave59 certifies seven owner deck-top-three costs across eleven physical
  sources. Short decks reject; exact three refreshes immediately; owner-relative
  orientation, cost order, opponent isolation, and printed effects are public.
- Coverage after generation should be 1400 matched / 1564 test-missing.

## Next

- Wave60: seven stun-definition records at `7a6f08e2.../4a353f40...`.
- Wave61: seven full-scene effect-entry/switch records at
  `c2d241b8.../0e19d91c...`; prove switch authority and entered-source effects.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
