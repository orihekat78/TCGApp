// cards/ct-p02/B02063 羽田秀吉 (キャラ) — engine拡張 wave#2 cluster5 (usage-restriction aura, 2026-06-14)
// rules: 09-cutin-disguise.md, 10-action-event.md, 12-next-hint.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   相手は【カットイン】を使用できない。
//   【FILE8】LP＋1
//   【ヒラメキ】（証拠からリムーブされるときに発動する）相手は手札を1枚リムーブする。
//
// 句マッピング:
//   a1: 「相手は【カットイン】を使用できない」=> continuous + continuousModifier.opponentRestrict:['cutin']
//       (cluster5 新 aura、無条件 = 常時有効。flow.contact.canCutIn が cut-in 側の相手盤面を走査)。
//       公式 qAndA「現場にいても相手は【変装】可能 (カットインと変装は別)」→ aura は canDisguise に触れない。
//   a2: 「【FILE8】LP＋1」=> continuous + condition fileAtLeast:8 + lpDelta:1 (SUPPORTED)。
//       公式 qAndA「【FILE8】はアシストしたパートナーも数える」→ fileAtLeast は file.length (assisted 含む) で一致。
//   a3: 【ヒラメキ】「相手は手札を1枚リムーブする」=> triggered evidence:remove-by-action optional +
//       discard{player:'opp', n:1} (D04010 同型 SUPPORTED)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 相手は【カットイン】を使用できない (無条件 = 常時)
  continuousModifier: { opponentRestrict: ['cutin'] },
  description: '相手は【カットイン】を使用できない。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'fileAtLeast', n: 8 }, // 【FILE8】(アシスト中パートナー含む)
  continuousModifier: { lpDelta: 1 },
  description: '【FILE8】LP＋1',
  ruleRefs: ['rules/12-next-hint.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】(任意発動)
  // 相手は手札を1枚リムーブする
  effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手は手札を1枚リムーブする。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B02063: CardDef = {
  id: 'B02063',
  no: '0226/B02063',
  kind: 'character',
  names: ['羽田秀吉'],
  colors: ['赤'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357267313068.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
