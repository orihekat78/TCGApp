// cards/pr-01/PR305 萩原研二 (character PR)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' },
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【パートナー黄】〚突撃〛（名乗り状態でもアクションできる）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'self' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察', kind: 'character' } }, nMin: 2 },
    ],
  },
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】自分の現場に〚特徴［警察］〛のキャラが2枚以上いる場合、このキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '松田陣平' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
  effect: {
    kind: 'atom',
    verb: 'invokeHiramekiOfCard',
    args: {
      occurrence: '$pick',
      trait: '警察',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'self', filter: { cardName: '松田陣平', kind: 'character' } },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【絆松田陣平】【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：自分の現場にいる〚カード名［松田陣平］〛を1枚まで選び、その【ヒラメキ】の効果を発動させてもよい。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const PR305: CardDef = {
  id: 'PR305',
  no: '1158/PR305',
  kind: 'character',
  names: ['萩原研二'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1785395500785031.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
