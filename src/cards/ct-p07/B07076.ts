import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const removeUpToLevelSum: Effect = {
  kind: 'sequence', steps: [
    { kind: 'atom', verb: 'discardDownTo', args: { player: 'self', n: 2, bind: '$discarded' } },
    { kind: 'atom', verb: 'sceneRemove', args: {
      uid: '$pick', target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 2 },
        query: { area: 'scene', side: 'either', aggregateLevelMax: { dyn: '$discarded.levelSum' } } },
    } },
  ],
};

const removeAllAndBan: Effect = {
  kind: 'sequence', steps: [
    { kind: 'atom', verb: 'discardDownTo', args: { player: 'self', n: 0 } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
    { kind: 'atom', verb: 'setCutinBan', args: { player: 'opp' } },
    { kind: 'atom', verb: 'setDisguiseBan', args: { player: 'opp' } },
  ],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand', condition: { kind: 'partnerColor', color: '\u8d64' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'choice', chooser: 'self', options: [removeUpToLevelSum, removeAllAndBan] },
  description: '\u3010\u30d1\u30fc\u30c8\u30ca\u30fc\u8d64\u3011\u4ee5\u4e0b\u304b\u30891\u3064\u9078\u3093\u3067\u884c\u3046\u3002',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B07076: CardDef = {
  id: 'B07076', no: '0805/B07076', kind: 'event', names: ['\u300c\u541b\u306f\u601d\u3063\u305f\u3088\u308a\u624b\u5f37\u3044\u3063\u3066\u4e8b\u304c\u306d\uff01\u300d'], colors: ['\u8d64'], level: 7,
  traits: [], rarity: 'C', imageUrl: '1762414027324057.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
