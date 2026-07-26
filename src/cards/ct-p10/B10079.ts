// CT-P10 B10079 爆弾犯 — rules/05, 07, 11, 15, 17
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { selfReasonBan: true, selfActionBan: true, cannotGuard: true },
  description: 'このキャラは推理できず、アクションできず、ガードできない。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
        { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
      ],
    },
  },
  description: '自分のターン終了時、このキャラをスリープさせてもよい。そうした場合、相手は手札を1枚リムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10079: CardDef = {
  id: 'B10079',
  no: '1135/B10079',
  kind: 'character',
  names: ['爆弾犯'],
  colors: ['黄'],
  level: 5,
  ap: 0,
  lp: 0,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1783904202676272.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
