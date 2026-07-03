// cards/pr-01/PR136 伊織無我 (character) — engine mega-wave W1 exemplar (charSetCard deckOwner:'picked-host', 2026-07-03)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【絆大岡紅葉】LP＋1
//   【パートナー緑】〚突撃〛（登場したターンからすぐにアクションできる）
//   【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、
//   キャラを1枚まで選び、持ち主のデッキのカードを上から1枚裏向きでセットする。
//
// a1: 【絆大岡紅葉】LP+1 = continuous condition{bond} + lpDelta (B01027 lpDelta 同型)。
// a2: 【パートナー緑】〚突撃〛 = partnerColorKeyword 共通クラス。
// a3: 【ターン1】observer。trigger = leave:to-remove (in-play observer、selfOnly なし) +
//     condition removedCharMatches{side:'opp', cause:'contact-ap', by:'self'}
//     (= 相手現場のキャラが / コンタクトAP判定で / このキャラ(byUid===source.uid)によってリムーブ、cluster15)。
//     effect = charSetCard 短縮形 {fromDeckTop, deckOwner:'picked-host', side:'either', max:1, faceUp:false}。
//     ★deckOwner:'picked-host' = W1 新 field: セット元デッキを pick した host キャラの持ち主側にする
//     (「持ち主のデッキのカードを上から1枚」)。「キャラを1枚まで選び」= 両現場 side:'either' + 0可 (rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

import { partnerColorKeyword } from '../_shared/partnerColorKeyword.js';

// a1: 【絆大岡紅葉】LP+1
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '大岡紅葉' },
  continuousModifier: { lpDelta: 1 },
  description: '【絆大岡紅葉】LP+1',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

// a2: 【パートナー緑】〚突撃〛
const a2: AbilityDef = partnerColorKeyword({ color: '緑', kw: '突撃', abilityId: 'a2' });

// a3: 【ターン1】コンタクト除去 observer → 持ち主デッキからセット
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  // 相手の現場にいるキャラが / このキャラとのコンタクト (AP判定) によって / リムーブされたとき
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      fromDeckTop: true,
      deckOwner: 'picked-host', // 持ち主 (pick した host の所有者) のデッキ上端
      player: 'self',           // 短縮形 gate 用 (候補 side は下の side が優先)
      side: 'either',           // 「キャラを1枚まで選び」= どちらの現場でも (rules/15)
      max: 1,                   // 0..1 (「1枚まで」)
      faceUp: false,            // 裏向きでセット (rules/16)
    },
  },
  description:
    '【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、キャラを1枚まで選び、持ち主のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const PR136: CardDef = {
  id: 'PR136',
  no: '0621/PR136',
  kind: 'character',
  names: ['伊織無我'],
  colors: ['緑'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['執事'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1747874027845277.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
