// cards/ct-p03/B03100 弓長警部 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚デッキのカードを上から1枚リムーブする〛：キャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 宣言【ターン1】 cost(デッキ上1枚リムーブ) → キャラ1枚を AP+1000 (ターン終了まで)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 〚デッキのカードを上から1枚リムーブする〛 (コスト)
  cost: { kind: 'removeDeckTop', player: 'self', n: 1 },
  // キャラを1枚まで選び、ターン終了時までAP＋1000する (literal delta なので短縮形 — D11014/D11015 同型)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'either', delta: 1000, scope: 'turn' } },
  description: '【宣言】【ターン1】〚デッキ上1枚リムーブ〛: キャラを1枚まで選び、ターン終了時までAP＋1000。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 — explicit target で fire 時 auto-pick)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B03100: CardDef = {
  id: 'B03100',
  no: '0353/B03100',
  kind: 'character',
  names: ['弓長警部'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133463304228.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
