// cards/ct-p03/B03058 茶木神太郎 (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【自分ターン中】【ターン1】このキャラ以外のキャラが【変装】したとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 本体ステータス: 茶木神太郎 / character / 白 / Lv5 / AP5000 / LP1 / 特徴[警察|警視庁] / 印字キーワードなし => CardDef kind 'character', colors:['白'], level:5, ap:5000, lp:1, traits:['警察','警視庁'], keywords:[] [.tmp/taskA/recs/B03058.json (no 迅速/突撃/疾風/ブレット printed icon → keywords:[]; henso='' so this card has NO 変装 itself, confirming it can never self-disguise). Same-shape character CardDef exemplar src/cards/ct-p04/B04017.ts (kind 'character', traits array).]
//   - 【自分ターン中】 (a1 condition icon) => ability.condition {kind 'turn', player:'self'} [src/engine/cond/eval.ts:35 case 'turn' = state.turn.player === resolvePlayer(cond.player,ctx). In eval allowlist eval.ts:430. EXACT exemplar src/cards/pr-01/PR117.ts a2 condition {kind 'turn',player:'self'} (【自分ターン中】) and src/cards/ct-p04/B04017.ts a1 (turn conjunct). handleHook evals ability.condition at trigger time before queue (src/engine/listeners/triggered.ts:283-296).]
//   - 【ターン1】 (a1 per-turn use cap) => ability.limit {kind 'turn', n:1} [src/engine/listeners/triggered.ts: handleHook enforces limit.kind==='turn' via readChar.declaredUseCount(uid,abilityId) >= n (per uid+abilityId, reset at turn boundary; fire-time count so even a decline consumes the use, rules/24). EXACT exemplar src/cards/pr-01/PR117.ts a2 limit {kind 'turn',n:1} on a triggered enter-observer ability; also src/cards/ct-p04/B04017.ts a1.]
//   - このキャラ以外のキャラが【変装】したとき (observer reacts to ANOTHER char disguising; exclude self; any side, any char) => trigger {hook 'disguise:into', matcherCondition:{kind 'triggerCharMatches', excludeSource:true, payloadKey:'uid'}} — NOT selfOnly [disguise:into is a registered TRIGGERED_HOOKS entry (src/engine/listeners/triggered.ts:85) routed to the GENERIC handleHook (registerTriggeredListener else-branch L405-406; only evidence:remove-by-action & leave:to-remove have special handlers). handleHook scans ALL collectCardsInPlay scene chars and only filters by selfOnly IF set (L224) — so a non-selfOnly observer fires for any disguise. Emit at src/engine/flow/contact.ts:207-212 fires for the disguising player p (either side) with payload {uid:targetUid,fromCardId,newCardId} and source {player:p,uid:targetUid}; payload LACKS 'player' → MUST use payloadKey:'uid' so triggerCharMatches derives side by scene-scan (src/engine/cond/eval.ts:319-330: tcmUid=pl['uid'], tcmPlayer by scanning both scenes). The disguised char stays in scene (mutate.char.disguiseInto preserves uid, swaps cardId) before emit, so scene lookup succeeds. excludeSource:true (eval.ts:334 tcmUid===ctx.source.uid → false) = 「このキャラ以外」 (type effect.ts:79). No 'side' = any side; no 'filter' = any 「キャラ」 (eval.ts: side undefined → both match, filter undefined → block skipped). Structural exemplar: src/cards/pr-01/PR117.ts a2 / B04017.ts a1 are the SAME non-selfOnly observer pattern on the 'enter' hook (whose payload also lacks 'player' → same payloadKey:'uid'); PR117 a2 additionally uses excludeSource:true ('このキャラ以外') verbatim. triggerCharMatches in eval allowlist (eval.ts:440).]
//   - カードを1枚引く (a1 mandatory effect) => effect {kind 'atom', verb 'draw', args:{player:'self', n:1}} [verb 'draw' {player,n} registered (capability-map ATOM_VERBS; runAtom draw → mutate.deck.draw). 'する' (not してもよい) = mandatory bare atom (no optional wrapper). EXACT exemplar src/cards/ct-p01/B01016.ts a2 draw {player:'self',n:1}. Effect is pure JSON (no closure).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 (a2) => ability a2 {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect:{kind 'atom', verb 'draw', args:{player:'self', n:1}}} [VERBATIM twin: src/cards/ct-p01/B01016.ts a2 (and ct-d01/D01013.ts a2) have the byte-for-byte identical clause and shape. Hirameki dispatch = special handler handleEvidenceRemovedHook (src/engine/listeners/triggered.ts:386-393, L419-490) which reads the removed-evidence card's def and runs its trigger.hook==='evidence:remove-by-action' ability; optional:true routes to pendingHirameki UI fire/skip surface. evidence:remove-by-action fires only on action[事件] removal (rules/10), correct for ヒラメキ.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'disguise:into',
    matcherCondition: {
      kind: 'triggerCharMatches',
      excludeSource: true,
      payloadKey: 'uid'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【自分ターン中】【ターン1】このキャラ以外のキャラが【変装】したとき、カードを1枚引く。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B03058: CardDef = {
  id: 'B03058',
  no: '0313/B03058',
  kind: 'character',
  names: [
    '茶木神太郎'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1729133406766835.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
