// cards/pr-01/PR046 鈴木園子 (キャラ, パラレル) — engine拡張 wave#2 cluster14 (multi-card sceneEnter, 2026-06-15)
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト (PR042 と同一):
//   【パートナー青】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある
//   レベル4以下の〚特徴［少年探偵団］〛のキャラを2枚まで選び、スリープ状態で登場させる。
//
// 句マッピングは PR042 を参照 (同一 ability)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '青' }, // 【パートナー青】
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', from: 'remove', cardIds: '$pick.cardIds', enterSleep: true, viaEffect: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団', levelMax: 4 } },
            n: { min: 0, max: 2 }, chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【パートナー青】【登場時】手札1枚リムーブしてもよい。そうした場合 リムーブのLv4以下[少年探偵団]を2枚までスリープ登場。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const PR046: CardDef = {
  id: 'PR046',
  no: '0400/PR046',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1727333980441051.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
