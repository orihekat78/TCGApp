// cards/ct-d03/D03011 京極真 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 05-turn-phases.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   自分のターン終了時、手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: phase:end:start (自分ターン) → chain(手札1枚リムーブ任意 → そうした場合このキャラを active) — D08003 a1 chain 同型
// a2: 【ヒラメキ】evidence:remove-by-action で1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、このキャラをアクティブにする
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
    ],
  },
  description: '自分のターン終了時、手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const D03011: CardDef = {
  id: 'D03011',
  no: '0127/D03011',
  kind: 'character',
  names: ['京極真'],
  colors: ['白'],
  level: 6,
  ap: 7000,
  lp: 0,
  traits: ['高校生', '空手家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132355294.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
