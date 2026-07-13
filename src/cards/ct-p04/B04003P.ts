import type { CardDef } from '@/engine/types';
export const B04003P: CardDef = {
  id: 'B04003P', no: '0408/B04003P', kind: 'character', names: ['工藤新一'], colors: ['青'], level: 8, ap: 8000, lp: 2, rarity: 'SRP', imageUrl: '1735287656202537.jpg', traits: ['探偵', '高校生'], keywords: [],
  abilities: [
    { id: 'a1', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, condition: { kind: 'turn', player: 'opp' }, trigger: { hook: 'effect:choose-intercept-discard', interceptTarget: { cardName: '毛利蘭' } } as never, description: '【絆毛利蘭】【相手ターン中】【ターン1】自分の現場にいる〚カード名［毛利蘭］〛が相手の能力や効果によって選ばれたとき、相手は手札を1枚リムーブしてもよい。そうしなかった場合、それを無効にする。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'] },
    { id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '毛利蘭', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 }] }, effect: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, filter: { apMax: 8000 }, pos: 'bottom' } }, description: '【宣言】【ターン1】【スリープ】〚手札からカード名［毛利蘭］を1枚公開する〛：AP8000以下のキャラを1枚まで選び、デッキの下に移す。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'] },
  ], ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/25-qa-effects-resolution.md'],
};
