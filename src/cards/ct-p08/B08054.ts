// cards/ct-p08/B08054 広田正巳 (キャラ) — engine-extension #5b batch (set-card)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   このキャラが相手の能力や効果、コンタクトによって現場を離れるとき、
//   このキャラに裏向きでセットされているすべてのカードをリムーブする代わりに手札に移す。
//   【宣言】【スリープ】：自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//
// a1: leave:intercept同期consult + hostLeaveSetCardReplacement。host本体は元の行先へ進み、
//     裏向きsetだけを通常removeの代わりにowner手札へ移す。
// a2: declared + sleepSelf cost → 自分のデッキ上端を 裏向きで $self にセット (engine#5b fromDeckTop)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:intercept',
    matcherCondition: { kind: 'leaveCauseIn', causes: ['contact-ap', 'effect'] },
  },
  hostLeaveSetCardReplacement: { kind: 'face-down-to-owner-hand' },
  description:
    'このキャラが相手の能力や効果、コンタクトによって現場を離れるとき、このキャラに裏向きでセットされているすべてのカードをリムーブする代わりに手札に移す。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' },
  },
  description: '【宣言】【スリープ】：自分のデッキ上端を裏向きでこのキャラにセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B08054: CardDef = {
  id: 'B08054',
  no: '0892/B08054',
  kind: 'character',
  names: ['広田正巳'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['大学教授'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731238644811.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
