import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'icon-disguise',
  condition: { kind: 'fileAtLeast', n: 5 },
  description: '\u3010\u5909\u88c5\u3011\u3010FILE5\u3011',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'disguise:into', selfOnly: true },
  effect: {
    kind: 'optional', chooser: 'opp-of-owner', aiRun: 'if-hand',
    effect: { kind: 'atom', verb: 'discard', args: {
      player: 'opp',
      target: { kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 1, max: 1 }, chooser: 'opp-of-owner' },
    } },
    else: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'contactImmune_action', val: true } },
  },
  description: '\u3010\u5909\u88c5\u6642\u3011\u76f8\u624b\u306f\u624b\u672d\u30921\u679a\u30ea\u30e0\u30fc\u30d6\u3057\u3066\u3082\u3088\u3044\u3002\u305d\u3046\u3057\u306a\u304b\u3063\u305f\u5834\u5408\u3001\u3053\u306e\u30ad\u30e3\u30e9\u306f\u3053\u306e\u30b3\u30f3\u30bf\u30af\u30c8\u306b\u3088\u3063\u3066\u30ea\u30e0\u30fc\u30d6\u3055\u308c\u306a\u3044\u3002',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$pick', delta: 2000, scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { cardNameNot: '\u30d9\u30eb\u30e2\u30c3\u30c8' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$pick', kw: '\u30d6\u30ec\u30c3\u30c8', scope: 'turn' } },
  ] },
  description: '\u3010\u767b\u5834\u6642\u3011\u3053\u306e\u30ad\u30e3\u30e9\u4ee5\u5916\u306e\u30ad\u30e3\u30e9\u30921\u679a\u307e\u3067\u9078\u3073\u3001\u30bf\u30fc\u30f3\u7d42\u4e86\u6642\u307e\u3067AP+2000\u3057\u3001\u3010\u30d6\u30ec\u30c3\u30c8\u3011\u3092\u4e0e\u3048\u308b\u3002',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md'],
};

export const B02086: CardDef = {
  id: 'B02086', no: '0247/B02086', kind: 'character', names: ['\u30d9\u30eb\u30e2\u30c3\u30c8'], colors: ['\u9ed2'],
  level: 5, ap: 4000, lp: 1, traits: ['\u9ed2\u305a\u304f\u3081\u306e\u7d44\u7e54'], keywords: [], rarity: 'SR', imageUrl: '1721357284566249.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
