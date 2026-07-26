// CT-P10 B10004 江戸川コナン
// rules: 03-field-areas.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  continuousModifier: { grantTraits: ['サッカー選手'] },
  description: '現場にいるこのキャラは〚特徴［サッカー選手］〛を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 3 },
  condition: { kind: 'and', cs: [
    { kind: 'partnerColor', color: '青' },
    { kind: 'fileAtLeast', n: 5 },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { kind: 'character', trait: 'サッカー選手' } }, nMin: 1 },
  ] },
  cost: { kind: 'removeSetCard', n: 1, hostSelf: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 } } },
    { kind: 'conditional', if: { kind: 'sourceDeclaredUseCount', cmp: 'eq', n: 3 }, then: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } } },
  ] },
  description: '【パートナー青】【FILE5】【宣言】【ターン3】〚このキャラに裏向きでセットされているカードを1枚リムーブする〛：AP8000以下のキャラを1枚まで選び、リムーブする。このキャラがこの【宣言】能力を使用したのがこのターン中で3回目の場合、自分は証拠を1つ得る。この能力は自分の現場にこのキャラ以外の〚特徴［サッカー選手］〛のキャラがいる場合に宣言できる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10004: CardDef = {
  id: 'B10004', no: '1066/B10004', kind: 'character', names: ['江戸川コナン'], colors: ['青'], level: 8, ap: 7000, lp: 2,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'], rarity: 'R', imageUrl: '1783904055268173.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10004P: CardDef = { ...B10004, id: 'B10004P', no: '1066/B10004P', rarity: 'RP', imageUrl: '1783904055275337.jpg' };
