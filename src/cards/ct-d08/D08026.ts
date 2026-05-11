// cards/ct-d08/D08026 青の古城探索事件 (事件)
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
// spec: .claude/specs/cards-analysis/D08026.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ以上表向きにする〛:
//     〚特徴［少年探偵団］〛のキャラを1枚まで選び、表向きにした証拠1つにつき、
//     ターン終了時までAP＋1000する。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: caseResolvedHandRemove({ n:1 })
// a2: caseDeclaredEvidenceFlip({ delta:+1000, targetFilter:{ trait:'少年探偵団' }, side:'self' })

import type { CardDef } from '@/engine/types';
import {
  caseResolvedHandRemove,
  caseDeclaredEvidenceFlip,
} from '@/cards/_shared/index';

export const D08026: CardDef = {
  id: 'D08026',
  no: '0499/D08026',
  kind: 'case',
  names: ['青の古城探索事件'],
  colors: ['青'],
  traits: [],
  rarity: 'D',
  imageUrl: '1743743100639068.jpg',
  caseLevel: 7,
  caseTraits: ['古城'],
  abilities: [
    caseResolvedHandRemove({ n: 1, abilityId: 'a1' }),
    caseDeclaredEvidenceFlip({
      delta: 1000,
      targetFilter: { trait: '少年探偵団' },
      side: 'self',
      abilityId: 'a2',
    }),
  ],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
