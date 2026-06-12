// cards/ct-p08/B08005 灰原哀 (キャラ) — engine拡張 wave#2 cluster (ability-presence filter, 2026-06-12)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト (TSV ct-p08/character 無省略):
//   effect:   【事件青＆黒】【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、リムーブする。
//   hirameki: 【ヒラメキ】自分のリムーブエリアにある【現場リムーブ時】を持つ【黒】のキャラを1枚まで選び、手札に加える。
//
// 句マッピング:
//   a1 (effect 列):
//     - 【事件青＆黒】 => caseColor{color:['青','黒'], combine:'and'} (2色すべてを持つ必要 / rules/17 §【事件(色1)&(色2)】)
//     - 【パートナー青】 => partnerColor{color:'青'} (rules/17 §【パートナー(色)】)
//       → 条件不成立時はこの能力を持たない扱い (rules/17 Point) なので and condition で gate
//     - 【登場時】 => trigger{hook:'enter', selfOnly:true} (能力/効果による登場でも発動 / rules/17)
//     - AP8000以下のキャラを1枚まで選び、リムーブする => sceneRemove short-form
//         {max:1, side:'either', filter:{apMax:8000}} (「キャラ」=現場、エリア指定なしは両現場 / rules/15。
//         「1枚まで」=0枚可 / rules/15。AP の有効値で判定 — D01004/D02002 同型)
//   a2 (hirameki 列):
//     - 【ヒラメキ】 => 証拠からリムーブされるときに発動 (アクション[事件]リムーブ時のみ / rules/10)。
//         type:'triggered' scope:'on-evidence' trigger{hook:'evidence:remove-by-action', optional:true}
//         (任意発動 — D01003/D11012 ヒラメキ同型)
//     - 自分のリムーブエリアにある【現場リムーブ時】を持つ【黒】のキャラを1枚まで選び、手札に加える
//         => handAddFromRemove short-form {max:1, filter:{keyword:'現場リムーブ時', color:'黒', kind:'character'}}
//         (「自分の」省略済 → player:'self' / rules/21。filter.keyword:'現場リムーブ時' は wave#2 cluster で
//          defHasKeyword が ability 構造から判定 — 印字静的判定。「1枚まで」=0枚可 / rules/15)

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

export const B08005: CardDef = {
  id: 'B08005',
  no: '0846/B08005',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1766493008973444.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
