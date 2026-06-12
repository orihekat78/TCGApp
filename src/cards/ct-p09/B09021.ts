// cards/ct-p09/B09021 服部平次 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】レベル8以下のキャラを1枚まで選び、リムーブする。
//   【事件青＆緑】【宣言】【ターン1】相手のFILEエリアにあるカードを上から1枚表向きにする。
//     相手のFILEエリアにある1番上のカードがキャラの場合、キャラを1枚まで選び、ターン終了時までAP＋1000する。
//
// 句マッピング:
//   - 【登場時】 => trigger{hook:'enter',selfOnly:true} (D08003/B09018 同型)
//   - レベル8以下のキャラを1枚まで選び、リムーブする => sceneRemove PA短縮形 {player:'self',max:1,side:'either',filter:{levelMax:8}}
//     (B04023 a1 step2 同型。エリア指定なしの「キャラ」=どちらの現場でも・自身も選択可、「1枚まで」=0枚可 rules/15)
//   - 【事件青＆緑】 => condition caseColor{['青','緑'],combine:'and'} (B09018 同型。rules/17「&」指定=全色必要)
//   - 【宣言】【ターン1】 => type:'declared' (コスト無し) + limit:{kind:'turn',n:1} (B09025 同型)
//   - 相手のFILEエリアにあるカードを上から1枚表向きにする => fileFlipTop{player:'opp'} (Task D E3。FILE空/既に表向きは no-op)
//   - 1番上のカードがキャラの場合 => conditional if fileTopMatches{side:'opp',filter:{kind:'character'}} (Task D E3。
//     アシスト中パートナーは「1番上のカード」に数えない = fileFlipTop が公開する札と同一参照)
//   - キャラを1枚まで選び、ターン終了時までAP＋1000する => charModifyAP PA短縮形 {player:'self',max:1,side:'either',delta:1000,scope:'turn'}
//   ※ 公式Q&A「すでに表向きの場合〜何も起こりませんが〜AP＋1000できます」 → 「そうした場合」chain ではなく sequence で表現
//     (fileFlipTop は不発でも chain-break flag を立てない仕様だが、句の独立性を sequence で明示)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // レベル8以下のキャラを1枚まで選び、リムーブする (どちらの現場でも / 自身も可 / 0枚選択可)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  description: '【登場時】レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【事件青＆緑】事件が青と緑の両色を持つ場合のみ能力を持つ (rules/17)
  condition: { kind: 'caseColor', color: ['青', '緑'], combine: 'and' },
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'sequence',
    steps: [
      // 相手のFILEエリアにあるカードを上から1枚表向きにする (既に表向き/FILE空は no-op、後続句は独立に評価 — 公式Q&A)
      { kind: 'atom', verb: 'fileFlipTop', args: { player: 'opp' } },
      // 相手のFILEエリアにある1番上のカードがキャラの場合、キャラを1枚まで選び、ターン終了時までAP＋1000する
      { kind: 'conditional', if: { kind: 'fileTopMatches', side: 'opp', filter: { kind: 'character' } }, then: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', max: 1, side: 'either', delta: 1000, scope: 'turn' } } },
    ],
  },
  description:
    '【事件青＆緑】【宣言】【ターン1】相手のFILEエリアにあるカードを上から1枚表向きにする。相手のFILEエリアにある1番上のカードがキャラの場合、キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09021: CardDef = {
  id: 'B09021',
  no: '0965/B09021',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1775608819055474.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
