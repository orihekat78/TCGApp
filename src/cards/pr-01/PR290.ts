// cards/pr-01/PR290 沖田総司 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【自分ターン中】現場にいるこのキャラをレベル＋1し、AP＋1000する。\n【パートナー緑】〚突撃〛（名乗り状態でもアクションできる）\n【事件緑＆白】【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時まで「このキャラはガードできる場合、必ずガードする。」を与える。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  continuousModifier: {
    apDelta: 1000,
    lvlDelta: 1
  },
  description: '【自分ターン中】現場にいるこのキャラをレベル＋1し、AP＋1000する。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2 = partnerColorKeyword({
  color: '緑',
  kw: '突撃',
  abilityId: 'a2'
});

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'caseColor',
    color: [
      '緑',
      '白'
    ],
    combine: 'and'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charSetTurnEffect',
    args: {
      uid: '$pick',
      key: 'mustGuard',
      val: true,
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'opp',
          filter: {
            kind: 'character'
          }
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【事件緑＆白】【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時まで「このキャラはガードできる場合、必ずガードする。」を与える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const PR290: CardDef = {
  id: 'PR290',
  no: '1061/PR290',
  kind: 'character',
  names: [
    '沖田総司'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生'
  ],
  rarity: 'PR',
  imageUrl: '1779885194410209.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md'
  ],
};
