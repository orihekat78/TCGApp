// cards/ct-p03/B03032 服部平次 (キャラ) — engine#5b charSetCard batch #3
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー緑】〚突撃〛（登場したターンからすぐにアクションできる）
//   このキャラは相手の現場にいるカードがセットされているアクティブ状態のキャラを指定してアクションできる。
//   【登場時】相手の現場にいるキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットする。
//
// a1: 【パートナー緑】 突撃 (keyword)
// a2: セットカードを持つ相手アクティブキャラをアクション対象に追加
// a3 (公式 a3): enter + 相手 1pick + opp-deck setCard (B02020 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー緑】 突撃
const a1 = partnerColorKeyword({ color: '緑', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:pre-target', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'expandActionTargets',
    args: { side: 'opp', state: ['active'], hasSetCards: true },
  },
  description: 'このキャラは相手の現場にいるカードがセットされているアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/16-card-set.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false },
  },
  description: '【登場時】相手キャラ1枚に 相手デッキ上端を裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B03032: CardDef = {
  id: 'B03032',
  no: '0289/B03032',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 7, ap: 5000, lp: 1,
  traits: ['探偵', '高校生'], keywords: [],
  rarity: 'C',
  imageUrl: '1729133249288453.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
