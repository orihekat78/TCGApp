// cards/ct-p08/B08005P 灰原哀 (キャラ・パラレル) — engine拡張 wave#2 cluster (ability-presence filter, 2026-06-12)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト (B08005 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる — TSV 全文比較で effect/hirameki 完全一致):
//   effect:   【事件青＆黒】【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、リムーブする。
//   hirameki: 【ヒラメキ】自分のリムーブエリアにある【現場リムーブ時】を持つ【黒】のキャラを1枚まで選び、手札に加える。
//
// 句マッピング: B08005.ts と同一 (同テキスト別ファイル full def 慣行 — B04068P 同様)。
//   a1: 【事件青＆黒】=> caseColor{['青','黒'],combine:'and'} / 【パートナー青】=> partnerColor{青} を and gate (rules/17)、
//       【登場時】=> trigger{hook:'enter',selfOnly:true}、AP8000以下のキャラを1枚まで選びリムーブ =>
//       sceneRemove short-form {max:1, side:'either', filter:{apMax:8000}} (両現場・0枚可 / rules/15)
//   a2: 【ヒラメキ】=> type:'triggered' scope:'on-evidence' trigger{hook:'evidence:remove-by-action',optional:true} (rules/10)、
//       リムーブの【現場リムーブ時】を持つ【黒】のキャラを1枚まで手札へ =>
//       handAddFromRemove short-form {max:1, filter:{keyword:'現場リムーブ時', color:'黒', kind:'character'}}
//       (filter.keyword:'現場リムーブ時' は wave#2 cluster の defHasKeyword 判定 — 印字静的判定 / 0枚可 / rules/15,21)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件青＆黒】【パートナー青】 (条件不成立なら能力を持たない扱い / rules/17)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
      { kind: 'partnerColor', color: '青' },
    ],
  },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // AP8000以下のキャラを1枚まで選び、リムーブする (両現場・0枚可)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
  description:
    '【事件青＆黒】【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】(証拠からリムーブされるときに発動 / rules/10) — 任意発動
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 自分のリムーブエリアにある【現場リムーブ時】を持つ【黒】のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { keyword: '現場リムーブ時', color: '黒', kind: 'character' } } },
  description: '【ヒラメキ】自分のリムーブエリアにある【現場リムーブ時】を持つ【黒】のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B08005P: CardDef = {
  id: 'B08005P',
  no: '0846/B08005P',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1771319691209979.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
