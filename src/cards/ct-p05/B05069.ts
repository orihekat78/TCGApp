// cards/ct-p05/B05069 ジェイムズ・ブラック (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー赤】【宣言】【スリープ】：レベル8以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に〚特徴［FBI］〛のキャラが3枚以上いる場合に宣言できる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 【パートナー赤】+ 現場[FBI]3枚以上 を condition に、【スリープ】cost → Lv8以下を1枚までリムーブ (D08026 a2 / D11021 a2 同型の condition gate + sceneRemove pick)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 inline)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー赤】かつ 自分の現場に[FBI]のキャラが3枚以上いる場合に宣言できる
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'FBI' } }, nMin: 3 },
    ],
  },
  cost: { kind: 'sleepSelf' }, // 【スリープ】(もともと sleep / stun なら canPay=false で宣言不可)
  // レベル8以下のキャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { levelMax: 8 } },
  },
  description: '【パートナー赤】【宣言】【スリープ】：レベル8以下のキャラを1枚まで選び、リムーブする。現場に[FBI]が3枚以上いる場合に宣言できる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/17-icons.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる (D08019 a2 同型: hirameki fire は明示 target を保持)
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
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B05069: CardDef = {
  id: 'B05069',
  no: '0569/B05069',
  kind: 'character',
  names: ['ジェイムズ・ブラック'],
  colors: ['赤'],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: ['FBI'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1745322205577998.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
