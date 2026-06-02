// cards/ct-d08/D08003 江戸川コナン (キャラ)
// rules: 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08003.md
//
// 公式テキスト:
//   【パートナー青】【登場時】手札から〚特徴［少年探偵団］〛のキャラを1枚リムーブしてもよい。
//     そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//   自分のターン終了時、自分の現場に〚特徴［少年探偵団］〛のキャラが3枚以上いる場合、カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー青】
  condition: { kind: 'partnerColor', color: '青' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から[少年探偵団]を1枚までリムーブ
      { kind: 'atom', verb: 'discard',     args: { player: 'self', max: 1, filter: { trait: '少年探偵団' } } }, 
      // 現場(味方/相手)のAP≤8000を1枚までリムーブ (step 1 applied 時のみ)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } }, 
    ],
  },
  description:
    '【パートナー青】【登場時】手札から[少年探偵団]を1枚リムーブしてもよい。そうした場合 AP8000以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分の現場に〚特徴［少年探偵団］〛のキャラが3枚以上いる場合、
    if: {kind: 'sceneHas',query: { area: 'scene', side: 'self', filter: { trait: '少年探偵団' } },nMin: 3,},
    // カードを1枚引く。
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '自分のターン終了時、現場の[少年探偵団]3枚以上で1ドロー。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/17-icons.md'],
};

export const D08003: CardDef = {
  id: 'D08003',
  no: '0489/D08003',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093434380.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
