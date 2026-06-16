// cards/ct-p06/B06031P 三好清海入道 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md
// 公式テキスト:
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき (trigger) => triggered ability scope 'on-scene', trigger {hook 'leave:to-remove'} (NO selfOnly), condition:{kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'} [Brief §反撃カード一族: 「このキャラとのコンタクトによってリムーブされたとき」→ {side:'opp', cause:'contact-ap', by:'self'}, trigger に selfOnly を付けない. Engine src/engine/cond/eval.ts L329-360 removedCharMatches case: reads ctx.triggerPayload {uid,cause,side,byUid}; side:'opp' rejects sameSide; cause:'contact-ap' must equal pl.cause; by==='self' requires byUid===ctx.source.uid (= observer は除去者=攻撃者). Type src/engine/types/effect.ts L71 confirms union shape. Registered CONDITION_KIND_MAP L421 (eval.ts) removedCharMatches:true. Hook emit src/engine/mutate/scene.ts L160-170 emits 'leave:to-remove' with {uid,cause,side:player,byUid}. Contact src/engine/flow/contact.ts L262-264 removeToRemove(state,bUid,'contact-ap',aUid) — aUid(=winner=attacker)が byUid として渡る (rules/08: 攻撃側は contact で除去されない、除去は常に bUid). Dispatch src/engine/listeners/triggered.ts L381-390: event.on('leave:to-remove') runs handleHook (in-play scan); L209-247 evaluates ability.condition with triggerPayload:payload injected; non-selfOnly so not gated by selfOnlyMatches. Exemplar same-set src/cards/ct-p06/B06009.ts a1 confirms leave:to-remove triggered ability shape (B06009 uses selfOnly for 【現場リムーブ時】; B06031 omits it為 observer).]
//   - カードを1枚引く (main effect) => effect:{kind 'atom', verb 'draw', args:{player:'self', n:1}} [src/engine/effect/validate.ts L22 ATOM_VERB_MAP draw:true. capability-map.txt L16: draw — args {player,n:number}, mutate.deck.draw pushes to hand. Exemplar src/cards/ct-p06/B06009.ts a1 step uses {kind 'atom',verb 'draw',args:{player:'self',n:1}} verbatim. 必須効果 (「引く」=必須, rules/15) → optional ラッパ不要, tier 1 surface (プレイヤー選択無).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => triggered ability scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect:{kind 'atom',verb 'draw',args:{player:'self',n:1}} [Exemplar src/cards/ct-p06/B06009.ts a2 (same set CT-P06) is identical shape minus the sceneHas conditional: scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect draw 1. B06031 hirameki has NO condition (unconditional 1 draw) so it is the simpler subset. Dispatch src/engine/listeners/triggered.ts L407-475 handleEvidenceRemovedHook: trig.optional===true → pushPendingHirameki (UI fire/skip委譲, rules/10). 'evidence:remove-by-action' hook in capability-map (rules/10 アクション[事件] による証拠リムーブのみ発火, rules/26 と整合).]
//   - stats / kind / color / level / ap / lp / features => kind 'character', colors:['緑'], level:6, ap:6000, lp:0, traits:['YAIBA'], keywords:[] [rec B06031.json: kind=character, color=緑, level=6, ap=6000, lp=0, features=YAIBA. traits フィールドは exemplar B06009.ts の traits:['猫'] と同形. keywords:[] — YAIBA は特徴(feature)であり印字 keyword (迅速/突撃/疾風/ブレット) ではない. cutIn/henso 空 → 追加 ability 無し.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: 'self'
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
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
    'rules/14-refresh.md',
    'rules/17-icons.md'
  ]
};

export const B06031P: CardDef = {
  id: 'B06031P',
  no: '0654/B06031P',
  kind: 'character',
  names: [
    '三好清海入道'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    'YAIBA'
  ],
  rarity: 'CP',
  imageUrl: '1755684931916565.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md'
  ],
};
