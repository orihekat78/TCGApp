// cards/ct-d10/D10026 The Black Knight (case)
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: { player: 'self', max: 1, filter: { cardName: 'シャッフルロマンス', kind: 'event' } },
      },
      {
        kind: 'atom',
        verb: 'useEventFromHand',
        args: { player: 'self', max: 1, filter: { cardName: 'シャッフルロマンス', kind: 'event' } },
      },
    ],
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：以下から1つ選んで行う。自分のリムーブエリアの〚カード名［シャッフルロマンス］〛を1枚まで手札に加える。／手札から〚カード名［シャッフルロマンス］〛のイベントを1枚まで使用する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const D10026: CardDef = {
  id: 'D10026',
  no: '0842/D10026',
  kind: 'case',
  names: ['The Black Knight'],
  colors: ['青'],
  caseTraits: [],
  traits: [],
  rarity: 'D',
  imageUrl: '1761913181983197.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
