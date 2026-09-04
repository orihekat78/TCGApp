// CT-P10 B10054 新出智明
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'caseColor', color: ['赤', '黄'], combine: 'and' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', chooseMatch: 'upTo', maxN: 4, filter: { color: ['赤', '黄'] }, bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } },
      { kind: 'conditional', if: { kind: 'boundMatchesFilter', bindKey: '$matched', filter: { levelMax: 6 } }, then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } },
    ] } },
    { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
  ] },
  description: '【事件赤＆黄】【登場時】自分のデッキのカードを上から4枚見る。その中から【赤】か【黄】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。レベル6以下のカードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B10054: CardDef = {
  id: 'B10054', no: '1113/B10054', kind: 'character', names: ['新出智明'], colors: ['赤'], level: 4, ap: 3000, lp: 1,
  traits: ['医師'], keywords: [], rarity: 'C', imageUrl: '1783904159417313.jpg', abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};
export const B10054P: CardDef = { ...B10054, id: 'B10054P', no: '1113/B10054P', rarity: 'CP', imageUrl: '1783904159424979.jpg' };
