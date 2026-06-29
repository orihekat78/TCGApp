// cards/ct-p09/B09096 キャンティ (キャラ) — engine0 wave (G15 relative-AP filter, 2026-06-29)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【解決編】【宣言】【スリープ】：このキャラと同じAPのキャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   【解決編】          => ability.condition { kind:'caseStatus', status:'解決編' } (rules/17)
//   【宣言】            => ability.type:'declared'
//   【スリープ】(コスト) => ability.cost { kind:'sleepSelf' } (rules/21、active 状態でのみ支払可)
//   このキャラと同じAPのキャラを1枚まで選び、リムーブする
//                       => sceneRemove 短縮形 {max:1, side:'either', cause:'effect',
//                          filter:{ apMin:{dyn:'$self.ap'}, apMax:{dyn:'$self.ap'} }}
//     - 「同じAP」= self の実効AP に等値 → apMin=apMax=$self.ap で exact 一致 (公式Q&A: self も対象も
//       解決時点の増減後 AP を参照 → resolveFilterDynObj が pick 列挙前に $self.ap を literalize、
//       candidates.ts:337-346 の合算 AP と突合。read.char.ap と同式 = filter-AP と combat-AP 一致 BUG-117 原則)
//     - filter 内 {dyn} 解決機構は cluster12 nested-filter-dyn (levelMax:{dyn:'$self.fileCount'} の D01014 等)
//       と同経路 (resolve-picks.ts resolveTargetFilterDyn、Pattern A=sceneRemove も honor)。engine変更0。
//     - 「1枚まで」= max:1 / n.min:0 (0枚可、rules/15)。「以外」表記なし → self も候補 (rules/15 自身選択可)。
//       side:'either' = 両現場 (rules/15 エリア指定なし「キャラ」= 現場)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【解決編】(条件不成立なら能力を持たない扱い / rules/17)
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【スリープ】コスト (自身をスリープ — active のみ支払可 / rules/21)
  cost: { kind: 'sleepSelf' },
  // このキャラと同じAPのキャラを1枚まで選び、リムーブする (両現場・0枚可)
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: { apMin: { dyn: '$self.ap' }, apMax: { dyn: '$self.ap' } },
    },
  },
  description: '【解決編】【宣言】【スリープ】このキャラと同じAPのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09096: CardDef = {
  id: 'B09096',
  no: '1035/B09096',
  kind: 'character',
  names: ['キャンティ'],
  colors: ['黒'],
  level: 5,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608926517832.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
