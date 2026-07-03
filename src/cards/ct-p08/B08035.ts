// cards/ct-p08/B08035 怪盗キッド (character) — engine mega-wave W4 r82 exemplar (bindPick, 2026-07-03)
// rules: 03-field-areas.md (状態3種/スタン特殊), 13-keywords.md, 15-abilities-effects.md (まで=0可),
//        16-card-set.md (裏向きセット), 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【解決編】【登場時】相手の現場にいるキャラを1枚まで選ぶ。そのキャラがスリープ状態の場合、スタンさせる。
//   そのキャラがアクティブ状態の場合、スリープさせる。
//   【宣言】【スリープ】：自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。
//   そうした場合、キャラを1枚まで選び、ターン終了時までAP＋2000する。
//
// a1: 【解決編】= condition caseStatus / 【登場時】= trigger enter selfOnly。
//     「1枚まで選ぶ」→ 分岐 = 共有 pick を bindPick (W4 r82) で bind:'t' に固定し、排他 conditional
//     (charStateIs fromBound) で sleep→stun / active→sleep。スタン対象は両分岐 false = 不変
//     (印字は stun 分岐に触れない、rules/03 スタンは明示解除まで維持)。
// a2: 【宣言】【スリープ】= declared + cost sleepSelf。「自分か相手の」= side:'either' (明示 cross-side)。
//     「裏向きでセットされている」= filter hasFaceDownSetCards + faceDownOnly (W4 同梱、B02033 は
//     裏向き限定なしゆえ opt-in arg)。「してもよい。そうした場合」= chain (rules/25)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手の現場にいるキャラを1枚まで選ぶ (0枚可 = decline で以降 no-op)
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', bind: 't', max: 1 } },
      {
        kind: 'conditional',
        // そのキャラがスリープ状態の場合、スタンさせる
        if: { kind: 'charStateIs', ref: { kind: 'fromBound', bindKey: 't' }, state: 'sleep' },
        then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$t.uid', state: 'stun' } },
        else: {
          kind: 'conditional',
          // そのキャラがアクティブ状態の場合、スリープさせる
          if: { kind: 'charStateIs', ref: { kind: 'fromBound', bindKey: 't' }, state: 'active' },
          then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$t.uid', state: 'sleep' } },
        },
      },
    ],
  },
  description: '【解決編】【登場時】相手の現場にいるキャラを1枚まで選ぶ。そのキャラがスリープ状態の場合、スタンさせる。そのキャラがアクティブ状態の場合、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'chain',
    steps: [
      // 自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'either', max: 1, faceDownOnly: true, filter: { hasFaceDownSetCards: true } } },
      // そうした場合、キャラを1枚まで選び、ターン終了時までAP＋2000する
      { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', side: 'either', delta: 2000, scope: 'turn', max: 1 } },
    ],
  },
  description: '【宣言】【スリープ】：自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、ターン終了時までAP＋2000する。',
  ruleRefs: ['rules/16-card-set.md', 'rules/21-declared-ability-cost.md', 'rules/25-qa-effects-resolution.md'],
};

export const B08035: CardDef = {
  id: 'B08035',
  no: '0874/B08035',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731222559511.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
