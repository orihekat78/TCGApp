// cards/ct-p02/B02005 沖野ヨーコ (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【ターン1】自分の現場にいる〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時までAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）を与える。
// 句マッピング:
//   - 【宣言】 => AbilityDef.type 'declared', scope 'on-scene' [src/cards/ct-p05/B05066.ts a2 と src/cards/ct-p07/B07079.ts a1/a2 が type 'declared'+scope 'on-scene' を使用。コストなし宣言能力 (本文に':'コロン無し) は B05066 a2 が cost プロパティ省略で実証 (rules/21: コストは':'左側、無ければコスト無)。]
//   - 【ターン1】 => AbilityDef.limit:{kind 'turn',n:1} [src/cards/ct-p07/B07079.ts a1/a2 と B05066.ts a2 が limit:{kind 'turn',n:1} を使用 (brief: 【ターンN】= limitPerTurn 相当)。]
//   - 自分の現場にいる〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時までAP＋2000し => sequence step1: charModifyAP 短縮形 carrier {max:1, side:'self', filter:{cardName:'毛利小五郎'}, delta:2000, scope 'turn', bind:'$picked'} [src/cards/ct-p07/B07079.ts a2 step1 が同型 charModifyAP {max:1, side:'self', filter:{trait:...}, delta:3000, scope 'turn', bind:'$picked'}; src/cards/ct-p08/B08032.ts が side:'self'+filter:{cardName:'京極真'}+delta+scope 'turn'。cardName filter は src/engine/effect/atom-handlers.ts:101-105 (短縮形 matcher) と src/engine/target/candidates.ts:261-263 で allCardNameComponentsForDef 経由で honored (rules/19 split-name 対応)。「1枚まで」=max:1(0枚可, rules/15)。「自分の現場」=side:'self'。scope 'turn'=ターン終了時まで (charModifyAP scope='turn'=mutate turn-cleared)。]
//   - 〚突撃〛（登場したターンからすぐにアクションできる）を与える => sequence step2: charGrantKeyword {uid:'$picked.uid', kw:'突撃', scope 'turn'} [src/cards/ct-p07/B07070.ts a1 step2 が同型 charGrantKeyword {uid:'$picked.uid', kw:'突撃', scope 'turn'}。src/engine/effect/atom-handlers.ts:1085-1105 (case 'charGrantKeyword') が resolveBindRef で '$picked.uid' を解決 (atom-handlers.ts:161-198 が $key.uid を ctx.bindings から解決、短縮形 carrier の runtime push で bind 共有, BUG-130)、grantScope は 'turn'|'contact'|'permanent' を受理し mutate.char.grantKeyword(s, uid, '突撃', 'turn') を呼ぶ。0枚/候補0 → '$picked' 未束縛 → step2 no-op (atom-handlers.ts:1099 startsWith('$') return)。突撃付与による名乗り中アクションは B07070/PR181/PR187 出荷済パターンと同一。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          max: 1,
          side: 'self',
          filter: {
            cardName: '毛利小五郎'
          },
          delta: 2000,
          scope: 'turn',
          bind: '$picked'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$picked.uid',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【宣言】【ターン1】自分の現場にいる〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時までAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B02005: CardDef = {
  id: 'B02005',
  no: '0177/B02005',
  kind: 'character',
  names: [
    '沖野ヨーコ'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    'アイドル'
  ],
  rarity: 'R',
  imageUrl: '1721357158829438.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
