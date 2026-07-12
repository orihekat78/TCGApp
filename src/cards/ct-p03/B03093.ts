// cards/ct-p03/B03093 西村京兵 (キャラ) — S2 保護系 wave (2026-07-11, untargetableByOppEventAura 初 consumer)
// rules: 03-field-areas.md, 15-abilities-effects.md, 19-special-rules.md
//
// 公式テキスト:
//   自分の現場にいる〚特徴［警察］〛のスリープ状態のキャラは、相手のイベントの効果によって選ばれない。
// 公式Q&A:
//   - 「キャラを○枚まで選ぶ」と書かれた相手イベントの効果で選べなくなる。キャラの能力や効果では選べる。
//     キャラを選ばないイベントの効果による影響は受ける。
//   - イベントがキャラに与えた/持たせた能力 (トランプ銃 B02052 等) は「そのキャラの能力」扱いで
//     「イベントの効果」ではない → 選べる (= source def.kind 判定が自然に満たす)。
//
// 句マッピング:
//   a1: untargetableByOppEventAura {trait:'警察'} + companion state ['sleep'] (S2 wave 新設 —
//       read.char.charUntargetableByOppEvent が bearer=自現場+PA-MR を board-scan、
//       resolve-picks.ts の pick chokepoint が source def.kind==='event' && 相手発のときのみ負 filter)。
//       aura は bearer 自身 (警察・スリープ時) も対象に含む (auraUntargetableByAction と同 posture)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    untargetableByOppEventAura: { trait: '警察' },
    untargetableByOppEventAuraState: ['sleep'],
  },
  description: '自分の現場にいる〚特徴［警察］〛のスリープ状態のキャラは、相手のイベントの効果によって選ばれない。',
  ruleRefs: ['rules/15-abilities-effects.md'],
};

export const B03093: CardDef = {
  id: 'B03093',
  no: '0346/B03093',
  kind: 'character',
  names: ['西村京兵'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '北海道警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133443695732.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md'],
};
