// CT-P10 B10010 工藤新一
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'bond', cardName: '毛利蘭' },
  continuousModifier: { opponentEventRestrict: ['remove'] },
  description: '【絆毛利蘭】このキャラは相手のイベントの効果によってリムーブされない。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 4, chooseMatch: 'upTo', filter: { kind: 'character' }, filterAny: [{ cardName: '工藤新一' }, { cardName: '毛利蘭' }], bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } },
    ],
  },
  description: '【登場時】自分のデッキのカードを上から4枚見る。その中から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};

export const B10010: CardDef = {
  id: 'B10010', no: '1072/B10010', kind: 'character', names: ['工藤新一'], colors: ['青'], level: 4, ap: 4000, lp: 1,
  traits: ['探偵', '高校生'], keywords: [], rarity: 'C', imageUrl: '1783904055332478.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};
