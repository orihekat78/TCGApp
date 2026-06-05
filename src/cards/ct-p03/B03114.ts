// cards/ct-p03/B03114 スコッチ (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー黒】【宣言】このキャラをリムーブする。レベル7以下のキャラを1枚まで選び、リムーブする。
//
// a1: 【パートナー黒】【宣言】(コロン無し → コスト無、全節が effect) →
//     sequence[このキャラをリムーブ (sceneRemove $self; B07021 a1 同型), レベル7以下を1枚まで選びリムーブ (sceneRemove 短縮形 pick; D08003 a1 / D11020 同型)]。
//     rules/15: 効果解決中に発動キャラが現場を離れても効果は継続 → step1 で自身除去後も step2 は解決。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー黒】
  condition: { kind: 'partnerColor', color: '黒' },
  effect: {
    kind: 'sequence',
    steps: [
      // このキャラをリムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
      // レベル7以下のキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
    ],
  },
  description: '【パートナー黒】【宣言】このキャラをリムーブする。レベル7以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B03114: CardDef = {
  id: 'B03114',
  no: '0363/B03114',
  kind: 'character',
  names: ['スコッチ'],
  colors: ['黒'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1729133482988756.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
