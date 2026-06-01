// cards/ct-d11/D11021 千速と重悟の婚活パーティー (事件)
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
// spec: .claude/specs/cards-analysis/D11021.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ以上表向きにする〛:
//     キャラを1枚まで選び、表向きにした証拠1つにつき、ターン終了時までAP－1000する。
//     この能力は自分の現場に〚特徴［神奈川県警］〛のキャラがいる場合に宣言できる。
//
// 先攻7 / 後攻6 (rules/01) — caseLevel は先攻基準。
// a1: inline triggered — 解決編 (case:to-resolved hook) になったとき discard self n=1
// a2: caseDeclaredEvidenceFlip({ delta:-1000, additionalCondition: sceneHas(神奈川県警>=1) })

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseDeclaredEvidenceFlip } from '@/cards/_shared/index';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
// D08013 と同様の inline triggered ability 形 (case:to-resolved hook で発火 / discard atom 短縮形)。
// ※ 解決編移行時の hook emit は mutate.case.toResolved に集約 (BUG-089)。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always', // 事件カードは case area 所在 → case:to-resolved hook + selfOnly で gate
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true, // 自分の事件カードが解決編になったときのみ発火 (source.uid===card.uid で gate / 相手の事件には誤発火しない)
  },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

export const D11021: CardDef = {
  id: 'D11021',
  no: '0946/D11021',
  kind: 'case',
  names: ['千速と重悟の婚活パーティー'],
  colors: ['黄'],
  traits: ['婚活'],
  rarity: 'D',
  imageUrl: '1775608977412418.jpg',
  caseLevel: 7,
  caseTraits: ['婚活'],
  abilities: [
    a1,
    caseDeclaredEvidenceFlip({
      delta: -1000,
      additionalCondition: {
        kind: 'sceneHas',
        query: { area: 'scene', side: 'self', filter: { trait: '神奈川県警' } },
        nMin: 1,
      },
      abilityId: 'a2',
    }),
  ],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
