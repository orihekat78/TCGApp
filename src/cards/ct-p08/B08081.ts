import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'sceneToHand', args: { player: 'self', side: 'opp', max: 1, filter: { levelMax: 8 } } },
  ] } },
  description: '【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、相手の現場にいるレベル8以下のキャラを1枚まで選び、手札に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'turn', player: 'opp' },
  trigger: { hook: 'effect:choose-intercept-discard', interceptTarget: { excludeSelf: true, requiresNonBlackSceneChar: true } } as never,
  description: '【相手ターン中】【ターン1】自分の現場にいるこのキャラ以外のキャラが相手の能力や効果によって選ばれたとき、相手は手札を1枚リムーブしてもよい。そうしなかった場合、それを無効にする。この能力は自分の現場に【黒】以外の色を持つキャラがいる場合に発動する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'],
};

export const B08081: CardDef = {
  id: 'B08081', no: '0917/B08081', kind: 'character', names: ['広田雅美'], colors: ['黒'], level: 6, ap: 5000, lp: 1,
  rarity: 'R', imageUrl: '1770731255819950.jpg', traits: ['黒ずくめの組織'], keywords: [], abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'],
};
