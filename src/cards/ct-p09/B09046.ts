// cards/ct-p09/B09046 鈴木次郎吉 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外の〚特徴［鈴木財閥］〛のキャラがいる場合、カードを1枚引く。自分の現場に〚特徴［探偵］〛のキャラがいる場合、レベル7以下のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: 【登場時】 sequence:
//   ・現場にこのキャラ以外の[鈴木財閥]がいる場合、カードを1枚引く (conditional sceneHas excludeSelf → draw / D08003 a2 同型)。
//   ・現場に[探偵]がいる場合、レベル7以下のキャラを1枚まで選び、スタンさせる
//     (conditional sceneHas → sceneSetState state:'stun' explicit pick / B06094 a1 同型)。
//   末尾の（）はスタン状態の標準挙動の補足で engine.scene.setState が処理 (rules/03/24)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にこのキャラ以外の[鈴木財閥]のキャラがいる場合、カードを1枚引く
      {
        kind: 'conditional',
        if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '鈴木財閥' }, excludeSelf: true }, nMin: 1 },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
      // 自分の現場に[探偵]のキャラがいる場合、レベル7以下のキャラを1枚まで選び、スタンさせる
      {
        kind: 'conditional',
        if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '探偵' } }, nMin: 1 },
        then: {
          kind: 'atom',
          verb: 'sceneSetState',
          args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { levelMax: 7 } }, n: { min: 0, max: 1 }, chooser: 'self' } },
        },
      },
    ],
  },
  description: '【登場時】現場にこのキャラ以外の[鈴木財閥]がいれば1ドロー。現場に[探偵]がいればレベル7以下を1枚までスタン。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/03-field-areas.md', 'rules/24-qa-naming-stun.md'],
};

export const B09046: CardDef = {
  id: 'B09046',
  no: '0989/B09046',
  kind: 'character',
  names: ['鈴木次郎吉'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856162182.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md',
  ],
};
