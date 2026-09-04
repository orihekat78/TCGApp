import type { AbilityDef, CardDef } from '@/engine/types';

const whiteOrYellow = ['\u767d', '\u9ec4'];

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '\u4e8b\u4ef6\u7de8' }, trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 3, bind: '$revealed' } },
    { kind: 'atom', verb: 'handAddFromDeck', args: {
      player: 'self', cardIds: '$pick.cardIds', bind: '$pickedCharacter', skipResolvesAtom: true,
      deferRefresh: true,
      target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 1 },
        query: { area: 'deck', side: 'self', fromGroupCards: '$revealed', filter: { kind: 'character', color: whiteOrYellow } } },
    } },
    { kind: 'atom', verb: 'handAddFromDeck', args: {
      player: 'self', cardIds: '$pick.cardIds', bind: '$pickedEvent', skipResolvesAtom: true,
      deferRefresh: true,
      target: { kind: 'pick', chooser: 'self', n: { min: 0, max: 1 },
        query: { area: 'deck', side: 'self', fromGroupCards: '$revealed', filter: { kind: 'event', color: whiteOrYellow } } },
    } },
    { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
    { kind: 'conditional', if: { kind: 'and', cs: [
      { kind: 'bound', key: '$pickedCharacter', presence: 'matched' },
      { kind: 'bound', key: '$pickedEvent', presence: 'matched' },
    ] }, then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } },
  ] },
  description: '\u3010\u4e8b\u4ef6\u7de8\u3011\u3010\u767b\u5834\u6642\u3011\u30c7\u30c3\u30ad\u306e\u4e0a\u304b\u30893\u679a\u898b\u308b\u3002',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, trigger: { hook: 'enter:group' },
  condition: { kind: 'and', cs: [
    { kind: 'caseStatus', status: '\u89e3\u6c7a\u7de8' }, { kind: 'turn', player: 'self' }, { kind: 'triggerPlayerIs', side: 'self' },
    { kind: 'boundAnyMatchesFilter', bindKey: 'enterGroup', filter: { kind: 'character', cardName: ['\u698e\u672c\u68d3', '\u5b89\u5ba4\u900f', '\u602a\u76d7\u30ad\u30c3\u30c9'] } },
  ] },
  effect: { kind: 'atom', verb: 'charModifyLevel', args: { player: 'self', side: 'opp', max: 1, delta: -1, scope: 'turn' } },
  description: '\u3010\u89e3\u6c7a\u7de8\u3011\u3010\u81ea\u5206\u30bf\u30fc\u30f3\u4e2d\u3011\u3010\u30bf\u30fc\u30f31\u3011\u767b\u5834\u6642\u3002',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B09078: CardDef = {
  id: 'B09078', no: '1018/B09078', kind: 'character', names: ['\u698e\u672c\u68d3'], colors: ['\u9ec4'], level: 4, ap: 3000, lp: 1,
  traits: ['\u55ab\u8336\u30dd\u30a2\u30ed'], keywords: [], rarity: 'C', imageUrl: '1775608910315749.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};
