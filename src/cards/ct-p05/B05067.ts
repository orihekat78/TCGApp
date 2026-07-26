// cards/ct-p05/B05067 メアリー (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターン終了時、自分のFILEエリアにあるカードが5枚以下の場合、レベル7以下のキャラを1枚まで選び、アクティブにする。
//   【パートナー赤】【宣言】【ターン1】キャラを1枚まで選び、リムーブする。この能力は自分のFILEエリアにあるカードが5枚以下の場合に宣言できる。
//
// a1: 自分のターン終了時 (phase:end:start, turn:self) + FILE≤5 (not fileAtLeast6) → Lv7以下を1枚まで active (D08003 a2 の conditional 同型)
// a2: 【パートナー赤】【宣言】【ターン1】FILE≤5 条件付き → キャラを1枚まで選びリムーブ (D08019 / eventRemoveByAP 同型の sceneRemove pick)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分のFILEエリアにあるカードが5枚以下の場合 (= 6枚以上でない)
    if: { kind: 'not', c: { kind: 'fileAtLeast', n: 6 } },
    // レベル7以下のキャラを1枚まで選び、アクティブにする (明示 target で pick を保持)
    then: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: { uid: '$pick', state: 'active', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { levelMax: 7 } }, n: { min: 0, max: 1 }, chooser: 'self' } },
        },
      ],
    },
  },
  description: '自分のターン終了時、FILEが5枚以下の場合、レベル7以下のキャラを1枚までアクティブにする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/17-icons.md', 'rules/03-field-areas.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー赤】かつ FILEが5枚以下の場合に宣言できる
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'not', c: { kind: 'fileAtLeast', n: 6 } },
    ],
  },
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // キャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', side: 'either', max: 1, cause: 'effect' },
  },
  description: '【パートナー赤】【宣言】【ターン1】キャラを1枚まで選び、リムーブする。FILEが5枚以下の場合に宣言できる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/17-icons.md', 'rules/15-abilities-effects.md'],
};

export const B05067: CardDef = {
  id: 'B05067',
  no: '0567/B05067',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1745322205572005.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
