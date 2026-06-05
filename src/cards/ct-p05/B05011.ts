// cards/ct-p05/B05011 雨城瑠璃 (キャラ) — engine-extension reasoning-hook batch #2 (2026-06-06 タスクC)
// rules: 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいる〚カード名［毛利小五郎］〛が推理したとき、カードを1枚引く。
//
// a1: 推理反応 (reasoning:end、非 selfOnly)。matcherCondition で「推理したキャラが自分側の
//     カード名[毛利小五郎]」を gate。【ターン1】= limit turn:1。効果は 1 ドロー。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'reasoning:end',
    // 推理したキャラ (payload) が自分側のカード名[毛利小五郎]のとき発火 (rules/11, 19 分割名対応)
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '毛利小五郎' } },
  },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ターン1】自分の現場の[毛利小五郎]が推理したとき、カードを1枚引く。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B05011: CardDef = {
  id: 'B05011',
  no: '0517/B05011',
  kind: 'character',
  names: ['雨城瑠璃'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322178400089.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
