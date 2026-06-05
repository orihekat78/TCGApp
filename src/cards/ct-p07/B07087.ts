// cards/ct-p07/B07087 白鳥任三郎 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【宣言】【ターン1】[警視庁] を1枚まで選び ターン終了まで AP＋1000 (D11012 a1 charModifyAP / D02013 a1 同型)。
// a2: 【ヒラメキ】evidence:remove-by-action (optional) → draw 1 (D08013 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する。
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', filter: { trait: '警視庁' }, scope: 'turn' } },
  description: '【宣言】【ターン1】[警視庁]のキャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】（証拠からリムーブされるときに発動する）任意発動
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く。
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B07087: CardDef = {
  id: 'B07087',
  no: '0815/B07087',
  kind: 'character',
  names: ['白鳥任三郎'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414027436058.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
