// cards/ct-p04/B04007 小林澄子 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚カード名［白鳥任三郎］〛を1枚まで選び、スリープ状態で登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【相手ターン中】【現場リムーブ時】リムーブのLv6以下[白鳥任三郎]1枚までスリープ状態で登場 => turn:opp + leave(selfOnly)→sceneEnter{from:remove,enterSleep:true,cardName+levelMax6,max:1} [B02004 a1 (from:remove) + D01012 (enterSleep:true)]
//   - 【ヒラメキ】キャラを1枚まで選びスリープ => evidence:remove-by-action(optional)→sceneSetState pick(D03013 a2 同型) [D03013 a2]

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
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: {
        cardName: '白鳥任三郎',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】リムーブのレベル6以下の〚カード名［白鳥任三郎］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
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
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/03-field-areas.md'
  ]
};

export const B04007: CardDef = {
  id: 'B04007',
  no: '0412/B04007',
  kind: 'character',
  names: [
    '小林澄子'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '教師'
  ],
  rarity: 'C',
  imageUrl: '1735287656236733.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ],
};
