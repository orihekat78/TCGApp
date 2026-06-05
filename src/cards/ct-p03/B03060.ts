// cards/ct-p03/B03060 茂木遥史 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚このキャラ以外の特徴［探偵］のキャラを1枚スリープさせる〛：レベル7以下のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 宣言能力 — cost 【スリープ】(sleepSelf) + 〚このキャラ以外の特徴[探偵]を1枚スリープ〛
//     (sleepChar pick / 自分の現場 trait探偵 excludeSelf, D01003 a1 同型) を pay で連結。
//     効果は sceneSetState stun の短縮形 pick (levelMax7, side either / D03002 a1 同型)。
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 $pick + explicit target)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】 + 〚このキャラ以外の特徴[探偵]のキャラを1枚スリープさせる〛 (自分の現場 / rules/21)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'sleepChar', target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { trait: '探偵' } }, n: { min: 1, max: 1 }, chooser: 'self' } },
    ],
  },
  // レベル7以下のキャラを1枚まで選び、スタンさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'stun', filter: { levelMax: 7 } } },
  description: '【宣言】【スリープ】〚このキャラ以外の特徴［探偵］を1枚スリープ〛：レベル7以下のキャラを1枚まで選び、スタンさせる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md', 'rules/14-refresh.md'],
};

export const B03060: CardDef = {
  id: 'B03060',
  no: '0315/B03060',
  kind: 'character',
  names: ['茂木遥史'],
  colors: ['白'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['探偵'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133406777252.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
