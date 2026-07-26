import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
  description: '【パートナー青】【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', cost: { kind: 'sleepSelf' },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: '$host', excludeSelf: true, filter: { kind: 'character', trait: 'サッカー選手', hasFaceDownSetCards: false } } },
    { kind: 'moveSetCard', hostUid: '$self', face: 'down', destination: { area: 'scene', hostUid: '$host.uid' } },
  ] },
  description: '【宣言】【スリープ】：自分の現場にいる裏向きのカードがセットされていない〚特徴［サッカー選手］〛のキャラを1枚まで選び、このキャラにセットされている裏向きのカードを1枚移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'declared', scope: 'on-scene',
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeSetCard', n: 1, hostSelf: true }] },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 6000 } } },
  description: '【宣言】【スリープ】〚このキャラに裏向きでセットされているカードを1枚リムーブする〛：AP6000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B10007: CardDef = {
  id: 'B10007', no: '1069/B10007', kind: 'character', names: ['赤木英雄'], colors: ['青'], level: 7, ap: 6000, lp: 1,
  traits: ['サッカー選手'], rarity: 'C', imageUrl: '1783904055304301.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10007P: CardDef = { ...B10007, id: 'B10007P', no: '1069/B10007P', rarity: 'CP', imageUrl: '1783904055311776.jpg' };
