// cards/ct-p02/B02040 黒羽盗一 (キャラ SR) — engine#5b charSetCard batch #3 (full impl)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー白】【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。
//   【宣言】【ターン1】自分の現場にいるこのキャラ以外の【白】のキャラを1枚まで選び、
//     自分のデッキのカードを上から1枚裏向きでセットし、ターン終了時までAP＋2000する。
//
// a1: 【パートナー白】 enter + levelMax:7 1pick sceneRemove
// a2: declared turn1 + 自陣【白】(excludeSelf) 1pick → setCard fromDeckTop + AP+2000 turn (sequence)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '白' },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } },
  },
  description: '【パートナー白】【登場時】レベル7以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'charSetCard',
            args: {
              uid: '$pick',
              fromDeckTop: true,
              faceUp: false,
              player: 'self',
              target: {
                kind: 'pick',
                query: { area: 'scene', side: 'self', filter: { color: '白' }, excludeSelf: true },
                n: { min: 0, max: 1 },
                chooser: 'self',
              },
            },
          },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: '$pick', delta: 2000, scope: 'turn' } },
        ],
      },
    ],
  },
  description: '【宣言】【ターン1】自陣 self 以外【白】1枚に self-deck setCard + ターン終了時まで AP+2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B02040: CardDef = {
  id: 'B02040',
  no: '0207/B02040',
  kind: 'character',
  names: ['黒羽盗一'],
  colors: ['白'],
  level: 8, ap: 7000, lp: 2,
  traits: ['マジシャン'], keywords: [],
  rarity: 'SR',
  imageUrl: '1721357230955975.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
