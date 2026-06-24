// cards/ct-p04/B04056 アンドレ・キャメル (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【事件編】【登場時】手札から〚特徴［FBI］〛のキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//   【解決編】LP＋1
//
// a1: triggered (enter) — 【事件編】で gate / 手札から[FBI]を1枚までリムーブ(してもよい)→ そうした場合カードを2枚引く
//     (chain: step1 discard FBI max:1 → step2 draw 2。no-candidate/decline で break — D08003 a1 同型)
// a2: continuous — 【解決編】で gate し self-only LP＋1 (lpDelta)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から[FBI]のキャラを1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', trait: 'FBI' } } },
      // そうした場合、カードを2枚引く (step1 実効果あり時のみ)
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【事件編】【登場時】手札から[FBI]を1枚リムーブしてもよい。そうした場合カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // LP＋1
  continuousModifier: { lpDelta: 1 },
  description: '【解決編】LP＋1。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04056: CardDef = {
  id: 'B04056',
  no: '0448/B04056',
  kind: 'character',
  names: ['アンドレ・キャメル'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['FBI'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287801237623.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
