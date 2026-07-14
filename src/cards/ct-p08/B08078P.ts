import type { AbilityDef, CardDef } from '@/engine/types';

const leaveKeywordFilter = { kind: 'character' as const, keyword: '現場リムーブ時' };
const abilities: AbilityDef[] = [
  {
    id: 'a1', type: 'declared', scope: 'on-scene', cost: { kind: 'sleepSelf' },
    condition: { kind: 'and', cs: [
      { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
      { kind: 'removeFilterAtLeast', player: 'self', filters: [leaveKeywordFilter], n: 2 },
    ] },
    effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' } } },
    description: '【事件青＆黒】【宣言】【スリープ】：キャラを1枚まで選び、リムーブする。この能力は自分のリムーブエリアに【現場リムーブ時】を持つキャラが2枚以上ある場合に宣言できる。',
    ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
  },
  {
    id: 'a2', type: 'triggered', scope: 'on-scene', condition: { kind: 'turn', player: 'opp' }, trigger: { hook: 'leave:to-remove', selfOnly: true },
    effect: { kind: 'optional', effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, bind: '$removed', filter: { kind: 'character', keyword: '現場リムーブ時', levelMax: 7, color: ['青', '黒'] } } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'optional', effect: { kind: 'atom', verb: 'invokeLeaveToRemoveOfCard', args: { cardId: '$removed.cardId', player: 'self' } } },
    ] } },
    description: '【相手ターン中】【現場リムーブ時】手札から【現場リムーブ時】を持つレベル7以下の【青】か【黒】のキャラを1枚リムーブしてもよい。そうした場合、カードを1枚引き、この効果によってリムーブしたカードの【現場リムーブ時】の効果を発動させてもよい。',
    ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
  },
];

export const B08078P: CardDef = {
  id: 'B08078P', no: '0914/B08078', kind: 'character', names: ['ジン'], colors: ['黒'], level: 8, ap: 7000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: ['現場リムーブ時'], rarity: 'SRCP', imageUrl: '1771322496640619.jpg', abilities,
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
