// cards/ct-p05/B05098 白鳥任三郎 (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/14-refresh.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：自分のリムーブエリアにある【黄】のイベントを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【宣言】(declared ability on a scene character) => type:'declared', scope:'on-scene' [D11012 a1 (src/cards/ct-d11/D11012.ts) — type:'declared', scope:'on-scene' for a 宣言 char ability; rules/21 declared usable from scene chars.]
//   - 〚デッキの下に移す〛 (cost: move this char to deck bottom) => cost:{ kind:'selfToDeckBottom' } [EXACT match D11012 a1 cost:{kind:'selfToDeckBottom'}. Engine wired: src/engine/cost/evaluate.ts case 'selfToDeckBottom' (canPay: findChar exists) + src/engine/cost/pay.ts case 'selfToDeckBottom' (mutate.scene.toDeckBottom on ctx.source.uid). No deck-count requirement → always payable while on scene (rules/21: no sleep icon → payable even if sleeping).]
//   - 自分のリムーブエリアにある【黄】のイベントを1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{color:'黄', kind:'event'}} [Pattern from B09044 a2 / B09088 a2 (handAddFromRemove {player:'self', max:1, filter:{color/kind}}). Verb registered in effect.ts AtomVerb, validate.ts ATOM_VERBS, runAtom switch (atom-handlers.ts case 'handAddFromRemove' splices from players[p].remove), short-form PB defaultArea='remove' sourceSplice (atom-pick-spec.ts). Filter honored on remove-area candidates: src/engine/target/candidates.ts line 253-256 (color OR-membership) + line 268-270 (kind:'event', BUG-118 fix comment explicitly cites B04009 'リムーブの【青】イベント' — same shape as 'リムーブの【黄】イベント'). '1枚まで' → max:1 with 0 allowed (pick/modal surface).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'selfToDeckBottom'
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        color: '黄',
        kind: 'event'
      }
    }
  },
  description: '【宣言】〚デッキの下に移す〛：自分のリムーブエリアにある【黄】のイベントを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/14-refresh.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B05098: CardDef = {
  id: 'B05098',
  no: '0596/B05098',
  kind: 'character',
  names: [
    '白鳥任三郎'
  ],
  colors: [
    '黄'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1745322226216860.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/14-refresh.md',
    'rules/20-color-and-switch.md'
  ],
};
