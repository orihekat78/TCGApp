// cards/ct-p03/B03042 「ボクは好きだな… 君みたいな熱い探偵…」 (event)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 5, bind: '$revealed' } },
      {
        kind: 'atom', verb: 'handAddFromDeck', args: {
          player: 'self', cardIds: '$pick.cardIds', skipResolvesAtom: true,
          target: {
            kind: 'pick',
            query: { area: 'deck', side: 'self', fromGroupCards: '$revealed', filter: { kind: 'character', trait: '探偵' }, distinctColors: true },
            n: { min: 0, max: 2 }, chooser: 'self',
          },
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'shuffle' } },
    ],
  },
  description: '自分のデッキのカードを上から5枚見る。その中から〚特徴［探偵］〛のキャラを1枚までと、そのキャラと同じ色を持たない〚特徴［探偵］〛のキャラを1枚まで公開して手札に加え、残りをシャッフルしてデッキの下に移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '探偵' } } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const B03042: CardDef = {
  id: 'B03042', no: '0299/B03042', kind: 'event', names: ['ボクは好きだな… 君みたいな熱い探偵…'],
  colors: ['緑'], level: 4, traits: [], rarity: 'C', imageUrl: '1729133385724214.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
