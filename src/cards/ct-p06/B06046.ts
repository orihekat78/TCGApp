// B06046 鉄刃 — rules/15,16,17. Face-up set cards alone have referable traits.
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'setcard:enter', selfOnly: true, matcherCondition: { kind: 'setCardMatches', filter: { trait: 'YAIBA' } } },
  condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 2 },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【自分ターン中】【ターン2】このキャラに〚特徴［YAIBA］〛のカード1枚がセットされるたび、このキャラをアクティブにする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'hostSetCardCountAtLeast', filter: { trait: 'YAIBA' }, n: 2 }] },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, enterSleep: true, viaEffect: true, filter: { kind: 'character', trait: 'YAIBA', levelMax: 5 } } },
  ] } },
  description: '自分のターン終了時、このキャラに〚特徴［YAIBA］〛のカードが2枚以上セットされている場合、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};
export const B06046: CardDef = { id: 'B06046', no: '0667/B06046', kind: 'character', names: ['鉄刃'], colors: ['白'], level: 8, ap: 8000, lp: 0, traits: ['YAIBA'], keywords: ['迅速'], rarity: 'SR', imageUrl: '197d4b60e6ae9.jpg', abilities: [a1, a2], ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'] };
