// cards/ct-d01/D01003 江戸川コナン (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚このキャラ以外のキャラを1枚スリープさせる〛：
//     カードを1枚引き、手札を1枚リムーブする。ターン終了時までこのキャラをLP＋1する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【宣言】【ターン1】cost sleepChar (自分の現場のこのキャラ以外) → draw1 + discard1 + self LP+1(turn)
// a2: 【ヒラメキ】カードを1枚引く (D08013 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 〚このキャラ以外のキャラを1枚スリープさせる〛 (cost の「自分の」省略 / rules/21 → side:'self' + excludeSelf)
  cost: {
    kind: 'sleepChar',
    target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引き
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // 手札を1枚リムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      // ターン終了時までこのキャラをLP＋1する
      { kind: 'atom', verb: 'charModifyLP', args: { uid: '$self', delta: 1, scope: 'turn' } },
    ],
  },
  description: '【宣言】【ターン1】〚このキャラ以外を1枚スリープ〛：1ドロー+手札1リム、ターン終了までこのキャラLP＋1。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
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

export const D01003: CardDef = {
  id: 'D01003',
  no: '0092/D01003',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100399303.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
