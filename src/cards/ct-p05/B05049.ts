// cards/ct-p05/B05049 中森青子 (character) — engine mega-wave W1 exemplar (cost revealHandToDeckTop, 2026-07-03)
// rules: 10-action-event.md, 13-keywords.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚手札からカード名［怪盗キッド］を1枚公開してデッキの上に移す〛：
//   〚カード名［黒羽快斗］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。
//   【ヒラメキ】自分のリムーブエリアにある〚カード名［黒羽快斗］〛を1枚まで選び、手札に加える。
//
// a1: cost = revealHandToDeckTop (W1 新 cost): 手札から〚怪盗キッド〛1枚を公開しデッキ上へ (公式Q&A:
//     裏向きで移す = deck は不可視で表現済)。rules/21 全部行えなければ使用不可 (canPay = candidates≥n)。
//     effect = charGrantKeyword pick 契約 (B01094 同型): 〚黒羽快斗〛のキャラ 0..1 に 突撃 turn 付与。
//     ★rules/19 複数名: 《怪盗キッド＆黒羽快斗/B05045》はコスト公開・効果選択の両方に該当 (公式Q&A B05049)。
//     engine の cardName filter は分割名を honor (effectiveNameComponents)。
// a2: 【ヒラメキ】handAddFromRemove (B03059 a2 同型・cardName 差替)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 〚手札からカード名[怪盗キッド]を1枚公開してデッキの上に移す〛
  cost: {
    kind: 'revealHandToDeckTop',
    target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '怪盗キッド' } }, n: { min: 1, max: 1 }, chooser: 'self' },
    n: 1,
  },
  // 〚カード名[黒羽快斗]〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$pick',
      kw: '突撃',
      scope: 'turn',
      target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { cardName: '黒羽快斗' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description:
    '【宣言】【ターン1】〚手札からカード名[怪盗キッド]を1枚公開してデッキの上に移す〛：〚カード名[黒羽快斗]〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  // 自分のリムーブエリアにある〚カード名[黒羽快斗]〛を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '黒羽快斗' } } },
  description: '【ヒラメキ】自分のリムーブエリアにある〚カード名[黒羽快斗]〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md'],
};

export const B05049: CardDef = {
  id: 'B05049',
  no: '0551/B05049',
  kind: 'character',
  names: ['中森青子'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1745322205512520.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
