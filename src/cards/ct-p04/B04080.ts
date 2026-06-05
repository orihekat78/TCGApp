// cards/ct-p04/B04080 目暮十三 (キャラ・ターン終了時) — catalog-reuse batch
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分のターン終了時、【黄】の〚特徴［警察］〛のキャラを1枚までと、【緑】の〚特徴［警察］〛のキャラを1枚まで選び、アクティブにする。
//
// a1: 自分のターン終了時 (phase:end:start + condition turn self) → 黄[警察]を1枚までアクティブ + 緑[警察]を1枚までアクティブ
//     (sequence で 2 pick。sceneSetState state='active' + 候補 filter は color/trait。$pick+choice 明示形で 1枚まで=0OK)
//     ※「アクティブにする」: スタン状態キャラは代わりにスリープ (rules/03/24) — engine 既定処理。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'sequence',
    steps: [
      // 【黄】の〚特徴［警察］〛のキャラを1枚まで選び、アクティブにする
      {
        kind: 'choice',
        chooser: 'self',
        options: [
          {
            kind: 'atom',
            verb: 'sceneSetState',
            args: {
              uid: '$pick',
              state: 'active',
              target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { color: '黄', trait: '警察' } }, n: { min: 0, max: 1 }, chooser: 'self' },
            },
          },
        ],
      },
      // 【緑】の〚特徴［警察］〛のキャラを1枚まで選び、アクティブにする
      {
        kind: 'choice',
        chooser: 'self',
        options: [
          {
            kind: 'atom',
            verb: 'sceneSetState',
            args: {
              uid: '$pick',
              state: 'active',
              target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { color: '緑', trait: '警察' } }, n: { min: 0, max: 1 }, chooser: 'self' },
            },
          },
        ],
      },
    ],
  },
  description: '自分のターン終了時、【黄】の[警察]を1枚までと【緑】の[警察]を1枚まで選び、アクティブにする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/03-field-areas.md'],
};

export const B04080: CardDef = {
  id: 'B04080',
  no: '0465/B04080',
  kind: 'character',
  names: ['目暮十三'],
  colors: ['黄'],
  level: 7,
  ap: 7000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287822658886.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
