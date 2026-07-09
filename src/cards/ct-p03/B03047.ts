// cards/ct-p03/B03047 京極真 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）\n【絆鈴木園子】AP＋1000\n【ターン1】このキャラのアクションがAP6000以下のキャラによってガードされたとき、このキャラをアクティブにする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'bond',
    cardName: '鈴木園子'
  },
  continuousModifier: {
    apDelta: 1000
  },
  description: '【絆鈴木園子】AP＋1000',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:guarded',
    selfOnly: true,
    matcherCondition: {
      kind: 'triggerCharMatches',
      payloadKey: 'guardUid',
      filter: {
        apMax: 6000
      }
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$self',
      state: 'active'
    }
  },
  description: '【ターン1】このキャラのアクションがAP6000以下のキャラによってガードされたとき、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md'
  ]
};

export const B03047: CardDef = {
  id: 'B03047',
  no: '0302/B03047',
  kind: 'character',
  names: [
    '京極真'
  ],
  colors: [
    '白'
  ],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: [
    '高校生',
    '空手家'
  ],
  rarity: 'SR',
  imageUrl: '1729133385759550.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
