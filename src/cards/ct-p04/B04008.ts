// cards/ct-p04/B04008 灰原哀 (キャラ・宣言+ヒラメキ) — catalog-reuse batch
// rules: 01-victory-conditions.md, 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【解決編】【宣言】【スリープ】〚手札から特徴［少年探偵団］のキャラを2枚リムーブする〛：レベル7以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: declared【解決編】 cost=【スリープ】+手札[少年探偵団]2枚リム / effect=レベル7以下を1枚までリムーブ
//     (D02013 a1 の removeFromHand cost + sceneRemove 短縮形 D11003 a2 同型)
// a2: 【ヒラメキ】カードを1枚引く (D08013 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【スリープ】+ 〚手札から特徴［少年探偵団］のキャラを2枚リムーブする〛 (pay で複合コスト)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 2, max: 2 }, chooser: 'self' }, n: 2 },
    ],
  },
  // レベル7以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } } },
  description: '【解決編】【宣言】【スリープ】〚手札の[少年探偵団]を2枚リムーブ〛: レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B04008: CardDef = {
  id: 'B04008',
  no: '0413/B04008',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287656240342.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
