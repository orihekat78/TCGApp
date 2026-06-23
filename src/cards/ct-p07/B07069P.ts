// cards/ct-p07/B07069P 本堂瑛海 (character, P) — wave codegen-handcount-setevent (engine変更0)
// rules: 03-field-areas.md, 12-next-hint.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// B07069 のパラレル。能力テキストは完全同一 (rarity/imageUrl のみ差) — 句マッピングは B07069.ts 参照。
//   a1:【パートナー赤】【宣言】【ターン1】レベル8以下のキャラを1枚まで選び、リムーブする。手札2枚以下で宣言可。
//   a2:【FILE8】【宣言】【ターン1】【スリープ】〚手札1枚 + FILE上1枚リムーブ〛→ リムーブから lv≤7赤キャラ1枚まで登場。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'handAtMost', player: 'self', n: 2 },
    ],
  },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  description: '【パートナー赤】【宣言】【ターン1】レベル8以下のキャラを1枚まで選び、リムーブする。この能力は自分の手札が2枚以下の場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'fileAtLeast', n: 8 },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'fileFrom', n: 1 },
    ],
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { color: '赤', levelMax: 7, kind: 'character' } },
  },
  description: '【FILE8】【宣言】【ターン1】【スリープ】〚手札を1枚リムーブし、FILEエリアにあるカードを上から1枚リムーブする〛：自分のリムーブエリアにあるレベル7以下の【赤】のキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/12-next-hint.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B07069P: CardDef = {
  id: 'B07069P',
  no: '0798/B07069P',
  kind: 'character',
  names: ['本堂瑛海'],
  colors: ['赤'],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: ['CIA'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1763546825775621.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
