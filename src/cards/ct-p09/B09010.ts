// cards/ct-p09/B09010 阿笠博士 (キャラ) — engine拡張 wave#2 cluster14 (multi-card sceneEnter, 2026-06-15)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【FILE6】【宣言】【スリープ】：自分のリムーブエリアにある、レベル4のそれぞれカード名の異なる
//   〚特徴［少年探偵団］〛のキャラを2枚まで選び、登場させる。自分のFILEエリアにあるカードを上から1枚リムーブする。
//
// 公式 qAndA (ct-p09 character.tsv): 0枚選択 or 阿笠自身を switch でリムーブしても「FILE上1枚リムーブ」まで解決する。
//   switch で「登場させるキャラ」自身はリムーブできない。
//
// 句マッピング (engine拡張 wave#2 cluster14):
//   - 【FILE6】 => condition fileAtLeast n:6 / 【宣言】【スリープ】 => declared + cost pay[sleepSelf]。
//   - 「レベル4のカード名相異[少年探偵団]を2枚まで登場」 => sceneEnter の multi-card 契約 (cardIds:'$pick.cardIds'、
//     n:{min:0,max:2}、distinctNames、filter levelMin:4&levelMax:4=EXACT)。現場満杯時は switchRemoveUids[] で switch。
//   - 「自分のFILEエリアにあるカードを上から1枚リムーブ」 => fileRemoveTop n:1 (必須・sequence 後段)。
//     0枚登場でも必須 (公式Q&A) のため sceneEnter に skipResolvesAtom:true を付与し decline でも remainder を解決。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'fileAtLeast', n: 6 }, // 【FILE6】
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }] }, // 【スリープ】
  effect: {
    kind: 'sequence',
    steps: [
      // レベル4(EXACT)のカード名相異[少年探偵団]を2枚まで登場 (skipResolvesAtom: 0枚でも後続 fileRemoveTop を解決)
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', from: 'remove', cardIds: '$pick.cardIds', skipResolvesAtom: true, viaEffect: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団', levelMin: 4, levelMax: 4 }, distinctNames: true },
            n: { min: 0, max: 2 }, chooser: 'self',
          },
        },
      },
      // 自分のFILEエリアにあるカードを上から1枚リムーブする (必須)
      { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【FILE6】【宣言】【スリープ】：リムーブのレベル4・カード名相異[少年探偵団]を2枚まで登場し、FILE上から1枚リムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

export const B09010: CardDef = {
  id: 'B09010',
  no: '0955/B09010',
  kind: 'character',
  names: ['阿笠博士'],
  colors: ['青'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['発明家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608802657577.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
