// cards/ct-p03/B03012 死羅神様 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】手札からレベル6以下の〚カード名［工藤新一］〛のキャラを1枚まで登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［工藤新一］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】手札からLv6以下[工藤新一]キャラ1枚まで登場 => turn:opp + leave(selfOnly)→sceneEnter{from:hand,cardName+levelMax6,max:1} [B05112 (from:hand) + B02004 a2 (leave+turn:opp)]
//   - 【ヒラメキ】リムーブの[工藤新一]1枚まで手札 => evidence:remove-by-action(optional)→handAddFromRemove{cardName,max:1} [B02004 a2 verb + B01011 a2 hook]

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
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'hand',
      max: 1,
      viaEffect: true,
      filter: {
        cardName: '工藤新一',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】手札からレベル6以下の〚カード名［工藤新一］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        cardName: '工藤新一',
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】リムーブの〚カード名［工藤新一］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const B03012: CardDef = {
  id: 'B03012',
  no: '0270/B03012',
  kind: 'character',
  names: [
    '死羅神様'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133048305270.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ],
};
