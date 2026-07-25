// cards/ct-p03/B03035 大滝悟郎 (character) — Task A green候補 (engine変更0)
// rules: rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【宣言】【スリープ】〚現場にいるキャラにセットされているカードを1枚リムーブする〛：カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【宣言】 => ability a1 type 'declared' [src/cards/ct-p03/B03036.ts a2 type 'declared' scope 'on-scene' for 【宣言】; brief DSL: 【宣言】= declared:true + cost.]
//   - 【スリープ】 (cost icon) => cost.items[0] {kind 'sleepSelf'} [src/cards/ct-p03/B03036.ts a2 cost.items[0]={kind 'sleepSelf'} models 【スリープ】 cost icon. canPay sleepSelf (src/engine/cost/evaluate.ts:30) requires active state (rules/21).]
//   - 〚現場にいるキャラにセットされているカードを1枚リムーブする〛 => removeSetCard{n:1, anyFace:true}。
//     「裏向き」の限定がないため表向きセットも支払える。自分の現場のみ (公式Q&A、rules/21)。
//   - 両コスト複合 (【スリープ】 + 〚removeSetCard〛) => cost {kind 'pay', items:[sleepSelf, removeSetCard]} [src/cards/ct-p03/B03036.ts a2 cost={kind 'pay', items:[{sleepSelf},{removeFromHand...}]} — same pay-combo of sleepSelf + bracketed cost (rules/21: コストを全て行う). canPay pay (evaluate.ts) = every item payable.]
//   - カードを1枚引く (a1 effect) => effect atom draw {player:'self', n:1} [src/cards/ct-d01/D01003.ts a1 sequence step draw {player:'self', n:1}. '〜する'=必須 (rules/15).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => ability a2 type 'triggered' scope 'on-evidence' trigger{hook 'evidence:remove-by-action', optional:true} [src/cards/ct-d01/D01003.ts a2 is byte-identical: triggered/on-evidence/hook evidence:remove-by-action optional:true. Hook valid src/engine/types/hooks.ts:67; card-def.ts:18 documents this as canonical ヒラメキ shape; scope 'on-evidence' card-def.ts:30.]
//   - カードを1枚引く (a2 ヒラメキ effect) => effect atom draw {player:'self', n:1} [src/cards/ct-d01/D01003.ts a2 effect atom draw {player:'self', n:1} — identical.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeSetCard',
        n: 1,
        anyFace: true
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【宣言】【スリープ】〚現場にいるキャラにセットされているカードを1枚リムーブする〛：カードを1枚引く。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
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

export const B03035: CardDef = {
  id: 'B03035',
  no: '0292/B03035',
  kind: 'character',
  names: [
    '大滝悟郎'
  ],
  colors: [
    '緑'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'C',
  imageUrl: '1729133249315783.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
