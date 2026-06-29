// cards/ct-p09/B09096P キャンティ (キャラ・パラレル) — engine0 wave (G15 relative-AP filter, 2026-06-29)
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト (B09096 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる — TSV 全文比較で effect 完全一致):
//   【解決編】【宣言】【スリープ】：このキャラと同じAPのキャラを1枚まで選び、リムーブする。
//
// 句マッピングは B09096.ts と同一 (同テキスト別ファイル full def 慣行 — B08005P 同様)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  cost: { kind: 'sleepSelf' },
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

export const B09096P: CardDef = {
  id: 'B09096P',
  no: '1035/B09096P',
  kind: 'character',
  names: ['キャンティ'],
  colors: ['黒'],
  level: 5,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1775608943873320.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
