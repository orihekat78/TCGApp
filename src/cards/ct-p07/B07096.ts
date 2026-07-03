// cards/ct-p07/B07096 ウォッカ (character) — engine mega-wave W4 r62 exemplar (filtered-突撃, 2026-07-03)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【パートナー黒】〚突撃［レベル4以下のキャラ］〛（登場したターンからすぐにレベル4以下のキャラを
//   指定してアクションできる）
//   【自分ターン中】【ターン1】相手の現場にいるレベル4以下のキャラがリムーブされたとき、カードを1枚引く。
//   【カットイン】AP＋1000
//
// a1: filtered-突撃 (W4 r62)。filter は名乗り例外のみを縛る — 公式Q&A「名乗り状態でない場合、
//     レベル5以上のキャラを指定できますか？ → はい」/「効果でレベル4以下になっているキャラを指定
//     できますか？ → はい」= per-target evaluated level (matchOneFilter)。
// a2: leave:to-remove observer + removedCharMatches{side:'opp', removedFilter:{levelMax:4}}。
//     公式Q&A: コンタクト/スイッチ等リムーブ方法問わず = cause 指定なし。
// cutIn: B08013 同型 (AP+1000 contact scope)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorFilteredAssault } from '../_shared/partnerColorFilteredAssault.js';

// 【パートナー黒】〚突撃［レベル4以下のキャラ］〛
const a1: AbilityDef = partnerColorFilteredAssault({
  color: '黒',
  targetKind: 'char',
  filter: { kind: 'character', levelMax: 4 },
  label: 'レベル4以下のキャラ',
  abilityId: 'a1',
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    // 相手の現場にいるレベル4以下のキャラがリムーブされたとき (方法問わず = cause なし)
    matcherCondition: { kind: 'removedCharMatches', side: 'opp', removedFilter: { kind: 'character', levelMax: 4 } },
  },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  limit: { kind: 'turn', n: 1 },               // 【ターン1】
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【自分ターン中】【ターン1】相手の現場にいるレベル4以下のキャラがリムーブされたとき、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// 【カットイン】AP＋1000 (B08013 同型)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B07096: CardDef = {
  id: 'B07096',
  no: '0823/B07096',
  kind: 'character',
  names: ['ウォッカ'],
  colors: ['黒'],
  level: 5,
  ap: 4000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762414027542624.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
