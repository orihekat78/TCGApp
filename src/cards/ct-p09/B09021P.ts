// cards/ct-p09/B09021P 服部平次 (キャラ・パラレル) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト (B09021 と同一、rarity/imageUrl/no のみ P 版):
//   【登場時】レベル8以下のキャラを1枚まで選び、リムーブする。
//   【事件青＆緑】【宣言】【ターン1】相手のFILEエリアにあるカードを上から1枚表向きにする。
//     相手のFILEエリアにある1番上のカードがキャラの場合、キャラを1枚まで選び、ターン終了時までAP＋1000する。
//
// 句マッピング: B09021.ts と同一 (同テキスト別ファイル full def 慣行 — B07073P 同様)。
//   - 【登場時】 => trigger{hook:'enter',selfOnly:true}
//   - レベル8以下のキャラを1枚まで選び、リムーブする => sceneRemove PA短縮形 {max:1,side:'either',filter:{levelMax:8}}
//   - 【事件青＆緑】 => condition caseColor{['青','緑'],combine:'and'}
//   - 【宣言】【ターン1】 => type:'declared' + limit:{kind:'turn',n:1}
//   - 上から1枚表向きにする => fileFlipTop{player:'opp'} / 1番上がキャラの場合 => conditional fileTopMatches
//   - キャラを1枚までAP＋1000 (ターン終了時まで) => charModifyAP PA短縮形 {max:1,side:'either',delta:1000,scope:'turn'}
//   ※ 公式Q&A: 既に表向きでも後続の AP＋1000 は実行可 → sequence (chain ではない)

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

export const B09021P: CardDef = {
  id: 'B09021P',
  no: '0965/B09021P',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'SRP',
  imageUrl: '1775608819065181.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
