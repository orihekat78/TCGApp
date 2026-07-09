// cards/ct-p02/B02080 三池苗子 (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/17-icons.md, rules/22-qa-action-contact.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にいる〚特徴［警察］〛のキャラのコンタクト中に自分が【カットイン】を使用したとき、このコンタクト中、そのキャラをAP＋1000する。
// 句マッピング:
//   - 【自分ターン中】【ターン1】自分の現場にいる〚特徴［警察］〛のキャラのコンタクト中に自分が【カットイン】を使用したとき、このコンタクト中、そのキャラをAP＋1000する => trigger cutin:used + matcherCondition and[triggerPlayerIs self, contactCharMatches byUid {trait 警察}] + charModifyAP $contact.byUid +1000 contact [matcherCondition = queue 時 gate (triggered.ts ctxMc が bindings.contact を持つ) — 非該当コンタクトでは発動せず【ターン1】未消費 (rules/24)。byUid = 自コンタクトキャラ (buildContactBindings p=self=使用者)。「そのキャラ」= 同じ $contact.byUid]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'cutin:used',
    matcherCondition: {
      kind: 'and',
      cs: [
        {
          kind: 'triggerPlayerIs',
          side: 'self'
        },
        {
          kind: 'contactCharMatches',
          who: 'byUid',
          filter: {
            trait: [
              '警察'
            ]
          }
        }
      ]
    }
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 1000,
      scope: 'contact'
    }
  },
  description: '【自分ターン中】【ターン1】自分の現場にいる〚特徴［警察］〛のキャラのコンタクト中に自分が【カットイン】を使用したとき、このコンタクト中、そのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B02080: CardDef = {
  id: 'B02080',
  no: '0241/B02080',
  kind: 'character',
  names: [
    '三池苗子'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1721357284540500.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md'
  ],
};
