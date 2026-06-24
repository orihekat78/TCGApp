// cards/ct-p09/B09018 量子 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【事件青＆緑】【登場時】手札から〚特徴［高校生］〛のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//
// a1: triggered (enter, selfOnly), 条件 caseColor 青&緑 — chain: 手札[高校生]を1枚までリムーブ → そうした場合 2ドロー (D08003 a1 chain 同型)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件青＆緑】(事件が青と緑の両色を持つ)
  condition: { kind: 'caseColor', color: ['青', '緑'], combine: 'and' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から[高校生]のキャラを1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '高校生' } } },
      // そうした場合、カードを2枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【事件青＆緑】【登場時】手札から[高校生]を1枚リムーブしてもよい。そうした場合、2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B09018: CardDef = {
  id: 'B09018',
  no: '0963/B09018',
  kind: 'character',
  names: ['量子'],
  colors: ['青'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608819013414.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
