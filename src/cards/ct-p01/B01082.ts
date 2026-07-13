// cards/ct-p01/B01082 榎本梓 (character)
// rules: 07-action-flow.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' },
  continuousModifier: { selfActionBan: true, cannotGuard: true, untargetableByAction: true },
  description: '【パートナー黄】このキャラはアクションできず、ガードできない。相手の現場にいるキャラはこのキャラを指定してアクションできない。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep', filter: { kind: 'character', levelMax: 7 }, bind: '$pick' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$pick.uid', key: 'noAutoActivateBySourceUid', val: '$self' } },
    ],
  },
  description: '【登場時】レベル7以下のキャラを1枚まで選び、スリープさせる。このキャラが現場にいるかぎり、選んだキャラはオートフェイズにアクティブにならない。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B01082: CardDef = {
  id: 'B01082', no: '0070/B01082', kind: 'character', names: ['榎本梓'], colors: ['黄'],
  level: 7, ap: 4000, lp: 1, traits: ['喫茶ポアロ'], keywords: [], rarity: 'SR', imageUrl: '1714013067520822.jpg',
  abilities: [a1, a2], ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
