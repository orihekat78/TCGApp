import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '\u4e8b\u4ef6\u7de8' }, trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'rps',
    win: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    lose: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ] },
  },
  description: '\u3010\u4e8b\u4ef6\u7de8\u3011\u3010\u767b\u5834\u6642\u3011\u76f8\u624b\u3068\u3058\u3083\u3093\u3051\u3093\u3067\u52dd\u6557\u3092\u6c7a\u3081\u308b\u3002',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  condition: { kind: 'caseStatus', status: '\u89e3\u6c7a\u7de8' }, trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '\u6bdb\u5229\u5c0f\u4e94\u90ce' } } },
  description: '\u3010\u30d2\u30e9\u30e1\u30ad\u3011\u3010\u89e3\u6c7a\u7de8\u3011\u81ea\u5206\u306e\u30ea\u30e0\u30fc\u30d6\u30a8\u30ea\u30a2\u306b\u3042\u308b\u301a\u30ab\u30fc\u30c9\u540d\uff3b\u6bdb\u5229\u5c0f\u4e94\u90ce\uff3d\u301b\u30921\u679a\u307e\u3067\u9078\u3073\u3001\u624b\u672d\u306b\u52a0\u3048\u308b\u3002',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B07011: CardDef = {
  id: 'B07011', no: '0743/B07011', kind: 'character', names: ['\u798f\u4e95\u67da\u5b09'], colors: ['\u9752'], level: 3, ap: 1000, lp: 1,
  traits: ['\u30d0\u30fc\u30c6\u30f3\u30c0\u30fc'], keywords: [], rarity: 'C', imageUrl: '1768203421251666.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
