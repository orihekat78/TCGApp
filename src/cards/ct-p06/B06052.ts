// cards/ct-p06/B06052 鉄剣十郎 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - 【登場時】手札1リムーブしてもよい。そうした場合、リムーブのLv6以下[YAIBA]キャラ1枚までスリープ状態で登場 => enter→optional{chain[discard1, sceneEnter{from:remove,enterSleep,trait:YAIBA,levelMax:6}]} [D05006 同型]
//   - 【カットイン】AP＋1000 => effect:declared(on-hand,optional,selfOnly)→charModifyAP{$contact.byUid,+1000,contact} [D01010 a2]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            max: 1,
            viaEffect: true,
            enterSleep: true,
            filter: {
              trait: 'YAIBA',
              levelMax: 6,
              kind: 'character'
            }
          }
        }
      ]
    }
  },
  description: '【登場時】手札を1枚リムーブしてもよい。そうした場合、リムーブのレベル6以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
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
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
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
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B06052: CardDef = {
  id: 'B06052',
  no: '0673/B06052',
  kind: 'character',
  names: [
    '鉄剣十郎'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    'YAIBA'
  ],
  rarity: 'C',
  imageUrl: '1754285220478940.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ],
};
