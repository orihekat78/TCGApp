// cards/ct-p06/B06075 宮野明美 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】：以下から1つ選んで行う。
//   ・レベル5以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//   ・レベル7以下のキャラを1枚まで選び、リムーブする。このキャラをスタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: 宣言能力 — cost 【スリープ】(sleepSelf) + 【ターン1】(limit turn:1)。
//     効果は choice — [レベル5以下スリープを1枚までリムーブ (sceneRemove level≤5 state sleep)] か
//     [レベル7以下を1枚までリムーブ → このキャラをスタン (sceneRemove level≤7 + sceneSetState stun self)]。
//     sceneRemove 短縮形 (player/max/side/filter/state) は D11020 / B03055 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】
  cost: { kind: 'sleepSelf' },
  // 以下から1つ選んで行う。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // ・レベル5以下のスリープ状態のキャラを1枚まで選び、リムーブする。
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 5 }, state: ['sleep'] } },
      // ・レベル7以下のキャラを1枚まで選び、リムーブする。このキャラをスタンさせる。
      {
        kind: 'sequence',
        steps: [
          // レベル7以下のキャラを1枚まで選び、リムーブする。
          { kind: 'atom', verb: 'sceneRemove',   args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
          // このキャラをスタンさせる。
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'stun' } },
        ],
      },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】：レベル5以下スリープを1枚までリムーブ、またはレベル7以下を1枚までリムーブしこのキャラをスタン。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B06075: CardDef = {
  id: 'B06075',
  no: '0695/B06075',
  kind: 'character',
  names: ['宮野明美'],
  colors: ['赤'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1754285244541865.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
