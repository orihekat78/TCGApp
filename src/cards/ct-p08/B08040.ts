// cards/ct-p08/B08040 鈴木次郎吉 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【相手ターン中】AP＋2000
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: continuous — 【相手ターン中】(turn opp) で gate し self-only AP＋2000 (apDelta、D08005 a1 continuous 同型)。
// a2: 【ヒラメキ】カードを1枚引く (D08013 a2 inline draw 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  // AP＋2000
  continuousModifier: { apDelta: 2000 },
  description: '【相手ターン中】AP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】(証拠からリムーブされるときに発動する) — 任意発動
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B08040: CardDef = {
  id: 'B08040',
  no: '0879/B08040',
  kind: 'character',
  names: ['鈴木次郎吉'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731222593463.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
