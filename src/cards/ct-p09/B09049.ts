// cards/ct-p09/B09049 南條欽治 (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターン終了時、自分の現場にいるこのキャラ以外のキャラを1枚スリープさせてもよい。そうした場合、このキャラをアクティブにする。
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアにある〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。
//
// a1: 自分のターン終了時 (phase:end:start + turn:self gate) chain (してもよい。そうした場合):
//   step1: 現場の他キャラを1枚スリープさせる (sceneSetState pick max:1, excludeSelf, skip で chain break / B02051 a1 同型)。
//   step2: このキャラをアクティブにする (sceneSetState uid:$self state:'active' / D03011 chain step2 同型)。
// a2: 【宣言】【スリープ】〚手札を1枚リムーブする〛cost → リムーブの[鈴木財閥]を1枚まで手札に加える
//   (cost pay[sleepSelf, removeFromHand] / handAddFromRemove / B05055 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' }, // 自分のターン終了時
  effect: {
    kind: 'chain',
    steps: [
      // 自分の現場にいるこのキャラ以外のキャラを1枚スリープさせてもよい (max:1 で skip 可能、skip 時は chain break)
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
      // そうした場合、このキャラをアクティブにする
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
    ],
  },
  description: '自分のターン終了時、現場の他キャラを1枚スリープさせてもよい。そうした場合、このキャラをアクティブにする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚手札を1枚リムーブする〛 (両方を支払う / もともと sleep / stun なら canPay=false で宣言不可)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 }] },
  // 自分のリムーブエリアにある[鈴木財閥]のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '鈴木財閥' } } },
  description: '【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアの[鈴木財閥]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const B09049: CardDef = {
  id: 'B09049',
  no: '0992/B09049',
  kind: 'character',
  names: ['南條欽治'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856197607.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
