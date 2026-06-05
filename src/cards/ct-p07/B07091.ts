// cards/ct-p07/B07091 閉ざされた秘密 (事件) — catalog-reuse batch
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ以上表向きにする〛:
//     〚特徴［警視庁］〛のキャラを1枚まで選び、この【宣言】能力のコストで表向きにした証拠1つにつき、
//     ターン終了時までAP＋1000する。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: 解決編になったとき discard self n=1 (caseResolvedHandRemove / D08026 a1 同型)。
// a2: 【解決編】【宣言】【ターン1】〚証拠表向き〛コストで [警視庁] キャラを 表向き枚数×AP＋1000 (ターン終了まで)。
//     caseDeclaredEvidenceFlip(delta:1000, targetFilter:[警視庁], side:'either') を使用 (D08026 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove, caseDeclaredEvidenceFlip } from '@/cards/_shared';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
const a1: AbilityDef = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

// a2: 〚証拠表向き〛コストで [警視庁] キャラを 表向き枚数×AP＋1000 (ターン終了まで)。
const a2: AbilityDef = caseDeclaredEvidenceFlip({
  delta: 1000,
  targetFilter: { trait: '警視庁' },
  side: 'either',
  abilityId: 'a2',
});

export const B07091: CardDef = {
  id: 'B07091',
  no: '0819/B07091',
  kind: 'case',
  names: ['閉ざされた秘密'],
  colors: ['黄'],
  traits: [],
  rarity: 'C',
  imageUrl: '1762414027497996.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
