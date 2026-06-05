// cards/ct-p01/B01087 風見裕也 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【絆降谷零】【宣言】【ターン1】ターン終了時までこのキャラをLP＋1するか、AP＋2000する。
//   [ヒラメキ欄] 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【絆降谷零】= condition bond / 【宣言】【ターン1】= declared + limit turn:1 / コスト無し。
//     effect = choice(このキャラ LP＋1 か AP＋2000、いずれもターン終了時まで)。uid:'$self' 固定。
// a2: 【ヒラメキ】1 ドロー (D08013 a2 と同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【絆降谷零】
  condition: { kind: 'bond', cardName: '降谷零' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // ターン終了時までこのキャラをLP＋1するか、AP＋2000する。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // ターン終了時までこのキャラを LP＋1
      { kind: 'atom', verb: 'charModifyLP', args: { uid: '$self', delta: 1, scope: 'turn' } },
      // ターン終了時までこのキャラを AP＋2000
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'turn' } },
    ],
  },
  description: '【絆降谷零】【宣言】【ターン1】ターン終了時までこのキャラをLP＋1するか、AP＋2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01087: CardDef = {
  id: 'B01087',
  no: '0075/B01087',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013067541294.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
