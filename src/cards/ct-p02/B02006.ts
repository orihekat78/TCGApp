// cards/ct-p02/B02006 仮面ヤイバー (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/10-action-event.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【カットイン】AP＋1000、レベル5以下の〚特徴［少年探偵団］〛のキャラに【カットイン】する場合、代わりにAP＋3000（コンタクト中に手札からリムーブして使う）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の現場に〚特徴［少年探偵団］〛のキャラがいる場合、カードを2枚引く。
// 句マッピング:
//   - 【カットイン】AP＋1000、レベル5以下の〚特徴［少年探偵団］〛のキャラに【カットイン】する場合、代わりにAP＋3000 => conditional{if contactCharMatches who byUid {trait[少年探偵団], levelMax 5}, then charModifyAP $contact.byUid +3000 contact, else +1000} [公式Q&A本カード=コンタクト中の自分のキャラで判定 (BUG-177 一次根拠)。B07050 a2 と同型 (代わりに=排他 else)。levelMax は board char 実効 level (matchOneFilter c!=null)]
//   - 【ヒラメキ】自分の現場に〚特徴［少年探偵団］〛のキャラがいる場合、カードを2枚引く => trigger evidence remove-by-action optional + conditional{if sceneHas self trait 少年探偵団 nMin1, then draw2} [sceneHas は B08091 a1 同型。hirameki 骨格 = D01003/PR006 a2]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'contactCharMatches',
      who: 'byUid',
      filter: {
        trait: [
          '少年探偵団'
        ],
        levelMax: 5
      }
    },
    then: {
      kind: 'atom',
      verb: 'charModifyAP',
      args: {
        uid: '$contact.byUid',
        delta: 3000,
        scope: 'contact'
      }
    },
    else: {
      kind: 'atom',
      verb: 'charModifyAP',
      args: {
        uid: '$contact.byUid',
        delta: 1000,
        scope: 'contact'
      }
    }
  },
  description: '【カットイン】AP＋1000、レベル5以下の〚特徴［少年探偵団］〛のキャラに【カットイン】する場合、代わりにAP＋3000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
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
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          trait: [
            '少年探偵団'
          ]
        }
      },
      nMin: 1
    },
    then: {
      kind: 'atom',
      verb: 'draw',
      args: {
        player: 'self',
        n: 2
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分の現場に〚特徴［少年探偵団］〛のキャラがいる場合、カードを2枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B02006: CardDef = {
  id: 'B02006',
  no: '0178/B02006',
  kind: 'character',
  names: [
    '仮面ヤイバー'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: [
    'ヒーロー'
  ],
  rarity: 'R',
  imageUrl: '1721357158835505.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/22-qa-action-contact.md'
  ],
};
