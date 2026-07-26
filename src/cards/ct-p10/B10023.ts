import type { AbilityDef, CardDef } from '@/engine/types';

// CT-P10 B10023 \u670d\u90e8\u5e73\u6b21
// rules: 15-abilities-effects.md, 16-card-set.md, 21-declared-ability-cost.md

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '緑' }, { kind: 'caseStatus', status: '解決編' }, { kind: 'handAtLeast', player: 'self', n: 1 }] },
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, filter: { kind: 'character', color: '緑', trait: '警察', levelMax: 6 } } },
  ] } },
  description: '【パートナー緑】【解決編】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の【緑】の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  cost: { kind: 'removeSetCard', n: 2 },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【宣言】【ターン1】〚現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブする〛：カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10023: CardDef = { id: 'B10023', no: '1084/B10023', kind: 'character', names: ['服部平次'], colors: ['緑'], level: 7, ap: 5000, lp: 1, traits: ['探偵', '高校生'], keywords: [], rarity: 'R', imageUrl: '1783904095084070.jpg', abilities: [a1, a2], ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'] };
export const B10023P: CardDef = { ...B10023, id: 'B10023P', no: '1084/B10023P', rarity: 'RP', imageUrl: '1783904095091840.jpg' };
