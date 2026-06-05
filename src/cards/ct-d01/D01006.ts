// cards/ct-d01/D01006 毛利蘭 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】キャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【登場時】キャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【宣言】【ターン1】キャラを1枚まで選び AP＋1000 (turn) — charModifyAP 短縮形 (side 既定 either)
// a2: 【登場時】キャラを1枚まで選び AP＋1000 (turn)
// a3: 【ヒラメキ】カードを1枚引く (D08013 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // キャラを1枚まで選び、ターン終了時までAP＋1000する (短縮形: uid 不在 → pick 構築 side 既定 either / max:1 = 0〜1)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', scope: 'turn' } },
  description: '【宣言】【ターン1】キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // キャラを1枚まで選び、ターン終了時までAP＋1000する
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', scope: 'turn' } },
  description: '【登場時】キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const D01006: CardDef = {
  id: 'D01006',
  no: '0095/D01006',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100407346.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
