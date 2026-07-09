// cards/ct-p07/B07046 ドロン刑事 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/17-icons.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）\n【自分ターン中】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカード1枚につき、このキャラをAP＋1000する。
// 句マッピング:
//   - 〚突撃［キャラ］〛 => keywords[突撃[キャラ]] [CardDef.keywords 印字 (rules/13)]
//   - 【自分ターン中】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカード1枚につき、このキャラをAP＋1000する => continuous condition{turn self} + continuousModifier{apDelta dyn $self.partnerAreaTraitCount.ビッグジュエル * 1000} [dyn token = 本 wave 新設 ($self.removeNameCount 同式 player-based)。常時有効型 = 発動でない (公式Q&A本カード・rules/24)。B06006 a2 apDelta dyn 同型]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  continuousModifier: {
    apDelta: {
      dyn: '$self.partnerAreaTraitCount.ビッグジュエル * 1000'
    }
  },
  description: '【自分ターン中】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカード1枚につき、このキャラをAP＋1000する。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B07046: CardDef = {
  id: 'B07046',
  no: '0775/B07046',
  kind: 'character',
  names: [
    'ドロン刑事'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '警察'
  ],
  rarity: 'C',
  imageUrl: '1762413994300164.jpg',
  keywords: [
    '突撃[キャラ]'
  ],
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ],
};
