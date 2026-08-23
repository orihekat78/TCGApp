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

## 2026-08-23: QA runtime Waves50-57

- Matching session files record stacked-vs-set separation, deck-look refresh,
  effect-entry repair, exact-two evidence costs, direct/nested entry, disguise,
  and arbitrary-position evidence. BUG-333/334/336/337 are included there.

## 2026-08-23: QA runtime Waves58-59

- Wave58 certifies seven owner-only one-card hand costs across ten physical
  sources. Opponent-shaped, malformed, and unavailable-sleep payments are atomic.
- Wave59 certifies seven owner deck-top-three costs across eleven physical
  sources. Short decks reject; exact three refreshes immediately; owner-relative
  orientation, cost order, opponent isolation, and printed effects are public.
- Coverage after generation should be 1400 matched / 1564 test-missing.

## 2026-08-23: QA runtime Waves60-61

- Wave60 certifies seven stun-definition records across eight physical sources.
  Public state transitions preserve stun under sleep/stun requests, replace an
  active request with sleep, and reject action/reasoning by a stunned actor.
- Wave61 certifies seven full-scene effect-entry records across thirteen physical
  sources. Every source may switch itself out after entering the fifth slot while
  the fired effect and nested entrant hook finish; forged cross-owner victims fail
  transactionally. No production or CardDef change was required.
- Coverage after generation is 1414 matched / 1550 test-missing.

## 2026-08-23: QA runtime Waves62-63

- Wave62 certifies nine face-down set-card privacy records across sixteen
  physical sources. Identity stays hidden from owner/spectator public surfaces
  until face-up removal; malformed and cross-owner payments reject atomically.
- BUG-338 corrects B08034/P official rarity from C/CP to R/RP.
- Wave63 certifies eight full-scene effect-entry records across eleven physical
  sources, including source-self switch, leave/enter order, exact delayed tails,
  owner symmetry, zero-entry, optional decline, and forged-victim rejection.
- Coverage after generation is 1431 matched / 1533 test-missing.

## Next

- Wave64: eight records at `c2a2f472.../fec16ced...`.
- Wave65: eight records at `e3bbd815.../fec16ced...`.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
