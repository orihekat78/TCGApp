import { caseResolvedHandRemove } from '@/cards/_shared';
import type { AbilityDef, CardDef } from '@/engine/types';

const activeLevelSixAction: AbilityDef = {
  id: 'b10100-active-level-six-action', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'action:pre-target', selfOnly: true },
  effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'], levelMin: 6 } },
  description: 'このキャラは相手の現場にいるレベル6以上のアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};

const contactRemoveDraw: AbilityDef = {
  id: 'b10100-contact-remove-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md'],
};

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'pay', items: [
    { kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } },
    { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  ] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'charGrantAbility', args: { player: 'self', side: 'self', max: 1, filter: { kind: 'character', cardName: ['工藤新一', '毛利蘭'] }, scope: 'turn', ability: activeLevelSixAction, bind: '$picked' } },
    { kind: 'atom', verb: 'charGrantAbility', args: { uid: '$picked.uid', scope: 'turn', ability: contactRemoveDraw } },
  ] },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにし、手札を1枚リムーブする〛：自分の現場にいる〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるレベル6以上のアクティブ状態のキャラを指定してアクションできる。」と「相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。」を与える。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/07-action-flow.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B10100: CardDef = {
  id: 'B10100', no: '1155/B10100', kind: 'case', names: ['工藤新一NYの事件'], colors: ['青', '黒'],
  caseLevel: 7, caseTraits: [], traits: [], rarity: 'R', imageUrl: '1783904247209660.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/07-action-flow.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10100P: CardDef = { ...B10100, id: 'B10100P', no: '1155/B10100P', rarity: 'RP', imageUrl: '1783904247219311.jpg' };
