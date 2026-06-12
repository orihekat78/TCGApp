// cards/ct-p09/B09015 円谷朝美 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある、〚カード名［円谷光彦］〛かレベル4の〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】リムーブの[円谷光彦]かレベル4[少年探偵団]キャラ1枚まで手札 => turn:opp + leave(selfOnly)→handAddFromRemove{filterAny:[{cardName:円谷光彦},{trait:少年探偵団,level=4}],max:1} [B02004 a2 + filterAny passthrough (atom-pick-spec buildShortFormPick L75)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filterAny: [
        {
          cardName: '円谷光彦',
          kind: 'character'
        },
        {
          trait: '少年探偵団',
          levelMin: 4,
          levelMax: 4,
          kind: 'character'
        }
      ]
    }
  },
  description: '【相手ターン中】【現場リムーブ時】リムーブの〚カード名［円谷光彦］〛かレベル4の〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const B09015: CardDef = {
  id: 'B09015',
  no: '0960/B09015',
  kind: 'character',
  names: [
    '円谷朝美'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1775608818986973.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
