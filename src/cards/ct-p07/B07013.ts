// rules: 10-action-event.md, 15-abilities-effects.md
import type { AbilityDef, CardDef } from '@/engine/types';

const allThree: AbilityDef['effect'] = {
  kind: 'sequence', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, side: 'either', state: ['stun'], bind: 'stunned' } },
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$stunned.uid', state: 'active' } },
    { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'stun', filter: { trait: '怪盗' } } },
    { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character' } } },
  ],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'choice', chooser: 'self', options: [
      { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, side: 'self', filter: { cardName: '江戸川コナン' }, bind: '$conan' } },
        { kind: 'conditional', if: { kind: 'bound', key: '$conan', presence: 'exists' }, then: allThree },
      ] },
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'stun', filter: { trait: '怪盗' } } },
      { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character' } } },
    ],
  },
  description: '以下から1つ選んで行う。自分の現場にいる〚カード名［江戸川コナン］〛を1枚スリープさせてもよい。そうした場合、代わりに3つとも行う。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B07013: CardDef = { id: 'B07013', no: '0745/B07013', kind: 'event', names: ['「今時、予告状を送りつける、レトロな泥棒さんの面をな…」'], colors: ['青'], level: 5, traits: [], rarity: 'C', imageUrl: '1762413976113832.jpg', abilities: [a1], ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'] };
