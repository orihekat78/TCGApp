// CT-P10 B10019 プロサッカー選手脅迫事件
// rules: 01-victory-conditions.md, 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: { kind: 'and', cs: [
    { kind: 'caseStatus', status: '解決編' },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { kind: 'character', trait: 'サッカー選手' } }, nMin: 1 },
  ] },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: {
    player: 'self', max: 1,
    filterAny: [
      { kind: 'character', trait: 'サッカー選手', levelMax: 6 },
      { kind: 'event', trait: 'ガジェット', levelMax: 6 },
    ],
  } },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のリムーブエリアにある、レベル6以下の〚特徴［サッカー選手］〛のキャラかレベル6以下の〚特徴［ガジェット］〛のイベントを1枚まで選び、手札に加える。この能力は自分の現場に〚特徴［サッカー選手］〛のキャラがいる場合に宣言できる。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10019: CardDef = {
  id: 'B10019', no: '1081/B10019', kind: 'case', names: ['プロサッカー選手脅迫事件'], colors: ['青'], caseLevel: 7, caseTraits: [], traits: [], rarity: 'R', imageUrl: '1783904095025459.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10019P: CardDef = { ...B10019, id: 'B10019P', no: '1081/B10019P', rarity: 'RP', imageUrl: '1783904095033295.jpg' };
