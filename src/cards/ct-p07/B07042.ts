// cards/ct-p07/B07042 式部鹿紫子 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある〚カード名［白馬探］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】リムーブの[白馬探]1枚まで手札 => turn:opp + leave:to-remove(selfOnly)→handAddFromRemove{cardName:白馬探,kind:character,max:1} [B02004 a2 同型 (cardName filter 同形)]

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
      filter: {
        cardName: '白馬探',
        kind: 'character'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】リムーブの〚カード名［白馬探］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const B07042: CardDef = {
  id: 'B07042',
  no: '0771/B07042',
  kind: 'character',
  names: [
    '式部鹿紫子'
  ],
  colors: [
    '白'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '執事'
  ],
  rarity: 'C',
  imageUrl: '1762413994273172.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
