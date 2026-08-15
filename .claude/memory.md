# Session memory

## 2026-07-29 Engine adversarial review

- Full record: `.claude/sessions/2026-07-29-engine-adversarial.md`.

## 2026-08-10: Private-hosted release and UI quality

- Rotated release and UI evidence:
  `.claude/sessions/2026-08-14-qa-wave13-match-cost.md`.
- Full UI session:
  `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.

## 2026-08-14: QA engine and public-evidence history

- Full record: `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`.

## 2026-08-15: Deck authority and held Hirameki checkpoint

- Deck decisions bind physical occurrences with a deck epoch. Every real deck
  mutation advances it and rebases all state-owned live binding holders once.
- Validated reorder/place/pick decisions consume persisted authority before
  continuation; stale or legacy-incomplete decisions load structurally, then
  consume and fizzle without executing effects or reviving after reload.
- Action Hirameki evidence is held by its exact ActionContext while pending.
  Fire may consume it directly to hand, scene, or partner area; skip, invalid
  effects, and terminal cleanup commit it to remove exactly once.
- B06027 full-scene Hirameki requires a current exact victim UID. Human UI uses
  a focused native scene-card control and blocks cancel while another decision
  owns input; AI, persisted state, and resolver revalidate the same witness.

## 2026-08-15: Leave interception and replacement continuation

- A leave-intercept accept applies the interceptor cost before the target move.
  Human set-card replacements serialize by physical occurrence and keep the
  contact/effect continuation state-owned across JSON restore and stale retries.
- Chain tails run only after an exact real removal. MR redirect, prevention,
  stale targets, and same-ID set cards do not satisfy that gate.

## 2026-08-15: Top-three choice, public identity, and switch

- “Reveal and add” exposes only the selected deck-card identity. Never persist
  the private hand or emit `hand:reveal`; close that presentation before showing
  the private bottom-order modal.
- A pick that resumes into `sceneEnter` carries only an absolute destination-side
  hint derived from its saved continuation. It is valid only when that side is
  reachable and the opposite side is not. Public dispatch revalidates the
  continuation, current switch UID, and exact physical deck occurrence.
- `$matched.cardId` is not physical authority. Deck-to-scene consumers must use
  the bound UID/index/witness so an unselected same-ID copy remains in “the rest”.
- Switch UI carries the absolute scene side; parent deck presentation may remain
  while the child picker runs. Status overlays pass pointer input through to
  scene cards. Mandatory deck reorder Escape confirms the untouched original order.

## 2026-08-16: Short-deck optional look and refresh

- A short `deckRevealUntil` window contains every remaining card. Looking alone
  never refreshes; taking the last card attempts refresh only after it leaves.
- Decline returns the exact occurrence without refreshing. Persisted duplicate
  choices retain UID, index, and occurrence witness through public hydration.

## 2026-08-16: Forced leave reveal and shuffle

- Forced reveal-until abilities never ask for a bottom-order decision when the
  printed sequence immediately shuffles the whole deck. Use
  `deckToBottomBound(order:'preserve')` before `deckShuffle`.
- Public certification proves the exact first match, mandatory hand transfer,
  no-match shuffle, self/timing gates, duplicate occurrence, and short refresh.

## 2026-08-16: Resumed effect source identity

- Top-level human pick, skip, choice, and optional resumes must restore the full
  source tuple: player, uid, cardId, abilityId, area, and resolutionKind.
- Reconstruct it through one shared helper. Missing legacy fields keep their
  existing fallback; never rewrite a non-scene source to scene implicitly.

## 2026-08-16: Mandatory self-sleep options

- A matching triggered ability fires before checking whether its optional
  self-sleep can resolve. Evaluate `charStateIs(self,active)` inside the effect,
  not as a listener condition; sleep and stun both suppress the optional tail.
- Preserve printed listener conditions, but move composite feasibility such as
  hand count or named-character presence into resolution-time predicates.
- The regression oracle scans all CardDefs and fixes the exact 45-printing
  footprint, including sequence tails and B09013's turn-limit path.
