// cards/ct-p06/B06009 トラカゲ (キャラ) — engine-extension #1 leave:to-remove batch
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の現場に〚特徴［少年探偵団］〛のキャラがいる場合、カードを1枚引く。
//
// a1: leave:to-remove 自発火 + turn=opp gate で 1 ドロー → discard 1 chain
// a2: 【ヒラメキ】少年探偵団 sceneHas 条件付き 1 ドロー

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '少年探偵団' } }, nMin: 1 },
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '【ヒラメキ】現場に[少年探偵団]がいる場合、カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B06009: CardDef = {
  id: 'B06009',
  no: '0634/B06009',
  kind: 'character',
  names: ['トラカゲ'],
  colors: ['青'],
  level: 2,
  ap: 1000,
  lp: 0,
  traits: ['猫'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754284680567255.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
