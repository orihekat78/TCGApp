// cards/pr-01/PR230 ジン (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/24-qa-naming-stun.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【パートナー黒】【登場時】すべてのキャラをスリープさせる。\n【相手ターン中】【現場リムーブ時】すべてのキャラをスリープさせる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【パートナー黒】【登場時】すべてのキャラをスリープ => partnerColor黒 + enter(selfOnly)→forEach over:all(scene,either)→sceneSetState{$each.uid,sleep} [B06071 (forEach over:all primitive-tested) + B01011 a1 hook]
//   - 【相手ターン中】【現場リムーブ時】すべてのキャラをスリープ => turn:opp + leave:to-remove(selfOnly)→同 forEach [B02004 a2 hook + B06071]
//   - 【ヒラメキ】キャラを1枚まで選びスリープ => evidence:remove-by-action(optional)→sceneSetState pick [D03013 a2 同型]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '黒'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'forEach',
    over: {
      kind: 'all',
      query: {
        area: 'scene',
        side: 'either'
      }
    },
    do: {
      kind: 'atom',
      verb: 'sceneSetState',
      args: {
        uid: '$each.uid',
        state: 'sleep'
      }
    }
  },
  description: '【パートナー黒】【登場時】すべてのキャラをスリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
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
    kind: 'forEach',
    over: {
      kind: 'all',
      query: {
        area: 'scene',
        side: 'either'
      }
    },
    do: {
      kind: 'atom',
      verb: 'sceneSetState',
      args: {
        uid: '$each.uid',
        state: 'sleep'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】すべてのキャラをスリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
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

export const PR230: CardDef = {
  id: 'PR230',
  no: '0931/PR230',
  kind: 'character',
  names: [
    'ジン'
  ],
  colors: [
    '黒'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'PR',
  imageUrl: '1771319691215196.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
