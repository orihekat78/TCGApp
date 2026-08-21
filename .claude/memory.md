# Session memory

## Prior records
- Engine adversarial: `.claude/sessions/2026-07-29-engine-adversarial.md`.
- Release/UI: `.claude/sessions/2026-08-14-qa-wave13-match-cost.md` and
  `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.
- QA engine/public evidence: `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`.

## 2026-08-15: Deck authority and held Hirameki checkpoint
- Deck decisions bind exact occurrences to an epoch; every mutation advances
  it, rebases state-owned holders once, and consumes validated authority first.
- Stale or legacy-incomplete decisions load structurally, then consume/fizzle
  without effects or revival. Hirameki evidence stays ActionContext-owned.
- Fire consumes held evidence once; skip/invalid/terminal commits it once.
  B06027 full-scene fire requires a current victim UID across UI, AI, and restore.

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

## 2026-08-16: Stunned action targets

- A stunned opposing character remains a legal character-action target, like a
  sleeping character; active and own-side characters remain illegal targets.
- Certify this shared rule through public action dispatch plus each card's
  concrete stun-producing contract, not by reusing event cards as scene actors.

## 2026-08-16: Repository dist test isolation

- Release preparation and security-header tests both own the checkout `dist/`.
  Hold one external temp lock across build plus inspection in parallel Vitest.
- Keep production release behavior unchanged; the parallel full suite is the
  acceptance gate for this test-only race fix.

## 2026-08-16: PR135/PR141 leave reveal

- PR135 and PR141 are printing twins and both own the same opponent-turn
  self-leave a2; never leave only one printing at a stale `DEFERRED` marker.
- The match is mandatory, the revealed remainder keeps its order before the
  full-deck shuffle, and a one-card deck refreshes from the leave source.

## 2026-08-16: Shuffled revealed remainder scope

- 「残りをシャッフルしてデッキの下に移す」は、公開した残りだけをshuffleする。
  `deckToBottomBound(bindKey:'$revealed',order:'shuffle')`を使い、後続`deckShuffle`を置かない。
- 完全一致6定義を静的に固定し、public選択あり/なし、複数取得、複数登場、離場後rebaseで
  未公開tailの順序不変を検証する。デッキ全体shuffleを明記する別句は混ぜない。

## 2026-08-21: Effect-enter QA boundaries
- d8dc certifies each real source through public trigger, filter, origin move, printed state, entered character's selfOnly enter ability, and terminal cleanup.
- B09025 scene entry must filter `kind:'character'`; a same-name event is the negative regression.
- B03030 may switch out its acting source; the next public `actionGuard(null)` aborts and clears the action without guard/contact.
- B02004 d8dc covers its action path only. Its `reasoning:end` hook conflicts with the printed post-sleep/pre-guard timing; track separately and do not call the whole card green.
