// cards/ct-p04/B04038 白馬探 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/17-icons.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【登場時】自分のリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - 〚ミスリード1〛 => __shared misreadX({x1, abilityId a1}) [D01010/B04079 VERBATIM]
//   - 【登場時】自分のリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする => removeAreaAllToDeckBottom{player self} [本 wave 新 param player (B08027 の両者対称形を self 片側化)。リフレッシュではない (証拠付与なし・rules/14) は既存 atom 契約]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'removeAreaAllToDeckBottom',
    args: {
      player: 'self'
    }
  },
  description: '【登場時】自分のリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/17-icons.md'
  ]
};

export const B04038: CardDef = {
  id: 'B04038',
  no: '0254/B04038',
  kind: 'character',
  names: [
    '白馬探'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'C',
  imageUrl: '1735287759504186.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/17-icons.md'
  ],
};
