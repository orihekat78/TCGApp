// rules: 03-field-areas.md, 07-action-flow.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'reasoning:end', hooks: ['action:declare'], selfOnly: true },
  effect: { kind: 'choice', chooser: 'self', options: [
    { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { kind: 'character', levelMax: 4, color: ['青', '白'] } } },
    { kind: 'conditional', if: { kind: 'paMrColorCountMin', side: 'self', min: 2 }, then: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'stun' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ] } },
  ] },
  description: 'このキャラが推理かアクションしたとき、以下から1つ選んで行う。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/22-qa-action-contact.md'],
};

export const B09047: CardDef = { id: 'B09047', no: '0990/B09047', kind: 'character', names: ['闇の男爵'], colors: ['白'], level: 6, ap: 6000, lp: 1, traits: ['怪盗'], rarity: 'C', imageUrl: '1775608856180870.jpg', abilities: [a1], ruleRefs: ['rules/03-field-areas.md', 'rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/22-qa-action-contact.md'] };
