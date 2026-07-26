// CT-P10 B10034 大阪ダブルミステリー 浪花剣士と太閤の城
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '緑', trait: '警察' } }, nMin: 2 },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：カードを1枚引く。この能力は自分の現場に【緑】の〚特徴［警察］〛のキャラが2枚以上いる場合に宣言できる。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10034: CardDef = {
  id: 'B10034', no: '1095/B10034', kind: 'case', names: ['大阪ダブルミステリー 浪花剣士と太閤の城'], colors: ['緑'],
  caseTraits: [], traits: [], rarity: 'C', imageUrl: '1783904116925771.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
export const B10034P: CardDef = { ...B10034, id: 'B10034P', no: '1095/B10034P', rarity: 'CP', imageUrl: '1783904116932408.jpg' };
