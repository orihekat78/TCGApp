// CT-P10 B10101 狙われた唇
// Rules: 01-victory-conditions, 03-field-areas, 14-refresh, 15-abilities-effects,
//        17-icons, 19-special-rules, 21-declared-ability-cost.
// Official Q&A: printed 「突撃」 or this card's active conditional icon counts;
// 「突撃[キャラ]」 and an ordinary ability grant do not.
import { caseResolvedHandRemove } from '@/cards/_shared';
import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const lookFourForAssault: Effect = {
  kind: 'sequence',
  steps: [
    {
      kind: 'atom',
      verb: 'deckRevealUntil',
      args: {
        player: 'self', maxN: 4, chooseMatch: 'upTo', visibility: 'public', viewer: 'all',
        filter: { kind: 'character', keywordFromPrintOrConditionIcon: '突撃' }, bind: '$revealed', bindMatch: '$matched',
      },
    },
    {
      kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
    },
    { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
  ],
};

const grantedAssaultSearch: AbilityDef = {
  id: 'b10101-granted-assault-search', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: lookFourForAssault,
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、デッキの上から4枚を見て、その中から【突撃】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: {
    kind: 'atom', verb: 'charGrantAbility',
    args: {
      player: 'self', side: 'self', max: 1, filter: { kind: 'character', color: ['緑', '白'] }, scope: 'turn',
      ability: grantedAssaultSearch,
    },
  },
  description: '自分の現場にいる【緑】か【白】のキャラを1枚まで選び、ターン終了時まで能力を与える。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const B10101: CardDef = {
  id: 'B10101', no: '1156/B10101', kind: 'case', names: ['狙われた唇'], colors: ['緑', '白'],
  caseLevel: 7, caseTraits: [], traits: [], rarity: 'C', imageUrl: '1783904247226776.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};
export const B10101P: CardDef = { ...B10101, id: 'B10101P', no: '1156/B10101P', rarity: 'CP', imageUrl: '1783904247234125.jpg' };
