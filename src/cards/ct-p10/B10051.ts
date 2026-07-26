// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'choice', chooser: 'self', options: [
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【ヒラメキ】以下から1つ選んで行う。キャラを1枚まで選び、スリープさせる。カードを1枚引く。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10051: CardDef = {
  id: 'B10051', no: '1110/B10051', kind: 'character', names: ['沖矢昴'], colors: ['赤'], level: 7, ap: 8000, lp: 1,
  traits: ['大学院生'], keywords: [], rarity: 'R', imageUrl: '1783904159381759.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};
