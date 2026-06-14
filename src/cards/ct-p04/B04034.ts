// cards/ct-p04/B04034 京極真 (キャラ) — engine拡張 wave#2 cluster5 (usage-restriction aura, 2026-06-14)
// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 23-qa-disguise-cutin.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【絆鈴木園子】【自分ターン中】相手は【カットイン】を使用できない。相手のキャラの【変装時】は発動しない。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［鈴木園子］〛を
//     1枚まで選び、手札に加える。
//
// 句マッピング:
//   gating 【絆鈴木園子】【自分ターン中】=> condition and[bond:'鈴木園子', turn:'self'] (rules/17 §絆/§条件)。
//   a1: 「相手は【カットイン】を使用できない」=> continuous + opponentRestrict:['cutin'] (条件成立中のみ有効)。
//   a2: 「相手のキャラの【変装時】は発動しない」=> continuous + opponentRestrict:['disguiseTrigger'] (同条件)。
//       flow.contact.disguise が disguise:into emit を抑止 (変装 swap 自体は成立)。
//       公式 qAndA「相手は【変装】可能。ただし【変装時】能力は発動しない」と一致 (a1=cutin / a2=変装時 を別 token に分離)。
//   a3: 【ヒラメキ】=> handAddFromRemove{player:'self', max:1, filter:{cardName:'鈴木園子', kind:'character'}}
//       (鈴木園子 はキャラ印字 → kind:'character' で remove area からキャラのみ pick、BUG-123)。

import type { AbilityDef, CardDef, Condition } from '@/engine/types';

// a1(cutin) と a2(disguiseTrigger) は同一 gating — lock-step を保つため condition literal を共有する。
const bondTurnCond: Condition = {
  kind: 'and',
  cs: [
    { kind: 'bond', cardName: '鈴木園子' }, // 【絆鈴木園子】(現場にカード名[鈴木園子]、パートナー不可 rules/17)
    { kind: 'turn', player: 'self' }, // 【自分ターン中】
  ],
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: bondTurnCond,
  continuousModifier: { opponentRestrict: ['cutin'] },
  description: '【絆鈴木園子】【自分ターン中】相手は【カットイン】を使用できない。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: bondTurnCond,
  continuousModifier: { opponentRestrict: ['disguiseTrigger'] },
  description: '【絆鈴木園子】【自分ターン中】相手のキャラの【変装時】は発動しない。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/23-qa-disguise-cutin.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】(任意発動)
  // 自分のリムーブエリアにある〚カード名［鈴木園子］〛を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '鈴木園子', kind: 'character' } } },
  description:
    '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［鈴木園子］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04034: CardDef = {
  id: 'B04034',
  no: '0432/B04034',
  kind: 'character',
  names: ['京極真'],
  colors: ['白'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['高校生', '空手家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287759482237.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/24-qa-naming-stun.md',
  ],
};
