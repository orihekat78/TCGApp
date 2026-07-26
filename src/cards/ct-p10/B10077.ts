// CT-P10 B10077 萩原研二 (character)
// rules: 14-refresh, 15-abilities-effects, 17-icons, 19-special-rules, 26-qa-deck-refresh

import type { AbilityDef, CardDef } from '@/engine/types';

const policeNames = ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'];

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '松田陣平' }, { kind: 'turn', player: 'self' }] },
  continuousModifier: { apDelta: 1000 },
  description: '【絆松田陣平】【自分ターン中】AP＋1000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo', player: 'self', maxN: 3,
          filter: { kind: 'character', cardName: policeNames }, bind: '$revealed', bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【登場時】自分のデッキのカードを上から3枚見る。その中から〚カード名［降谷零］〛か〚［諸伏景光］〛か〚［伊達航］〛か〚［萩原研二］〛か〚［松田陣平］〛を1枚まで公開して手札に加え、残りをリムーブエリアに移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};

export const B10077: CardDef = {
  id: 'B10077', no: '1133/B10077', kind: 'character', names: ['萩原研二'],
  colors: ['黄'], level: 4, ap: 3000, lp: 1, traits: ['警察', '警視庁'], keywords: [], rarity: 'C',
  imageUrl: '1783904202661928.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};
