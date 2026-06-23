// cards/ct-p07/B07069 本堂瑛海 (character) — wave codegen-handcount-setevent (engine変更0)
// rules: 03-field-areas.md, 12-next-hint.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   a1:【パートナー赤】【宣言】【ターン1】レベル8以下のキャラを1枚まで選び、リムーブする。
//        この能力は自分の手札が2枚以下の場合に宣言できる。
//   a2:【FILE8】【宣言】【ターン1】【スリープ】〚手札を1枚リムーブし、FILEエリアにあるカードを上から1枚リムーブする〛：
//        自分のリムーブエリアにあるレベル7以下の【赤】のキャラを1枚まで選び、登場させる。
//
// 公式Q&A (a2):
//   - 【FILE(8)】はちょうど8枚でも (コスト支払で1枚減るが) 使用可 → 宣言可否は支払前の FILE 枚数で判定。
//   - 【FILE(8)】は【アシスト】したパートナーも数える → fileAtLeast は file.length (パートナー含む) で判定。
//   - コストの「FILE上から1枚リムーブ」はパートナーを除いて上から1枚 → mutate.file.popTop が
//     assisted-partner を除外 (mutate/file.ts:42-50) ので faithful。
//   - 手札/FILE からリムーブしたカードも条件を満たせば選んで登場可 → リムーブエリアからの pick (engine 既定)。
//
// 句マッピング (全句 既存 verb/cost/cond、engine変更0):
//   a1:【パートナー赤】+「手札2枚以下で宣言できる」=> declared condition and[partnerColor:'赤', handAtMost:2]
//        (rules/17 能力保持条件 + rules/21 宣言ゲート、両方 declared.condition で gate。B07067 a2 = and[handAtMost, …] 同型)。
//      【ターン1】=> limit{turn, n:1}。
//      「レベル8以下のキャラを1枚まで選び、リムーブ」=> sceneRemove{max:1, side:'either', filter:{levelMax:8}}
//        (B07067 a1/a2 と同一短縮形。max:1=0枚可 rules/15、side:'either'=両者現場 rules/15)。
//   a2:【FILE8】=> condition fileAtLeast{n:8} (D09014 a1 同型)。【ターン1】=> limit{turn, n:1}。
//      【スリープ】+〚手札1枚リムーブ + FILE上1枚リムーブ〛=> cost pay[sleepSelf, removeFromHand, fileFrom{n:1}]
//        (B05037 a1 = pay[sleepSelf, fileFrom] / B07034 a2 = removeFromHand pick 同型。一部でも払えねば宣言不可 rules/21)。
//      「リムーブエリアのレベル7以下【赤】キャラを1枚まで登場」=> sceneEnter{from:'remove', max:1, viaEffect:true,
//        filter:{color:'赤', levelMax:7, kind:'character'}} (B01076 a1 完全同型。kind:'character' 必須 BUG-123)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1:【パートナー赤】【宣言】【ターン1】レベル8以下のキャラを1枚までリムーブ (手札2枚以下で宣言可)。
const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【パートナー赤】(能力保持条件 rules/17) かつ 自分の手札2枚以下 (宣言ゲート rules/21)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'handAtMost', player: 'self', n: 2 },
    ],
  },
  // レベル8以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  description: '【パートナー赤】【宣言】【ターン1】レベル8以下のキャラを1枚まで選び、リムーブする。この能力は自分の手札が2枚以下の場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

// a2:【FILE8】【宣言】【ターン1】【スリープ】〚手札1枚 + FILE上1枚リムーブ〛→ リムーブから lv≤7赤キャラ1枚まで登場。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【FILE8】(アシストパートナー含めて8枚以上、rules/17 §FILE(X))
  condition: { kind: 'fileAtLeast', n: 8 },
  // 【スリープ】+〚手札を1枚リムーブ + FILEエリアを上から1枚リムーブ〛 (一部でも払えねば宣言不可 rules/21)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
      { kind: 'fileFrom', n: 1 },
    ],
  },
  // 自分のリムーブエリアにあるレベル7以下の【赤】のキャラを1枚まで選び、登場させる (0枚可 rules/15)
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { color: '赤', levelMax: 7, kind: 'character' } },
  },
  description: '【FILE8】【宣言】【ターン1】【スリープ】〚手札を1枚リムーブし、FILEエリアにあるカードを上から1枚リムーブする〛：自分のリムーブエリアにあるレベル7以下の【赤】のキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/12-next-hint.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B07069: CardDef = {
  id: 'B07069',
  no: '0798/B07069',
  kind: 'character',
  names: ['本堂瑛海'],
  colors: ['赤'],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: ['CIA'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762414010658085.jpg',
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
