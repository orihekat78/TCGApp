// cards/pr-01/PR006 江戸川コナン (キャラ) — catalog-reuse batch
// rules: 08-contact.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【自分ターン中】このキャラがコンタクトしたとき、手札を1枚リムーブしてもよい。そうした場合、そのコンタクト中、このキャラをAP＋2000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【自分ターン中】コンタクト発生時 (contact:start) → 手札1枚リムーブしてもよい (chain step1) → そうした場合 AP＋2000 (contact scope, chain step2)
// a2: 【ヒラメキ】(evidence:remove-by-action optional) → 1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【自分ターン中】
  condition: { kind: 'turn', player: 'self' },
  // このキャラがコンタクトしたとき
  trigger: { hook: 'contact:start', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、そのコンタクト中、このキャラをAP＋2000する (step1 applied 時のみ)
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'contact' } },
    ],
  },
  description:
    '【自分ターン中】このキャラがコンタクトしたとき、手札を1枚リムーブしてもよい。そうした場合、そのコンタクト中、AP＋2000。',
  ruleRefs: ['rules/08-contact.md', 'rules/22-qa-action-contact.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const PR006: CardDef = {
  id: 'PR006',
  no: '0161/PR006',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1714013177235696.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
