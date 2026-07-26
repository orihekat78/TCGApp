// CT-P10 B10061 骨董盆は隠せない
// rules: 01-victory-conditions.md, 14-refresh.md, 15-abilities-effects.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'pay', items: [
    { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    { kind: 'removeDeckTop', player: 'self', n: 2 },
  ] },
  effect: { kind: 'choice', chooser: 'self', options: [
    { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' }, delta: 2000, scope: 'turn' } },
    { kind: 'conditional', if: { kind: 'handAtMost', player: 'self', n: 2 }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
  ] },
  description: '【解決編】【宣言】【ターン1】〚手札を1枚リムーブし、デッキのカードを上から2枚リムーブする〛：以下から1つ選んで行う。・キャラを1枚まで選び、ターン終了時までAP＋2000する。・自分の手札が2枚以下の場合、カードを1枚引く。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B10061: CardDef = {
  id: 'B10061', no: '1120/B10061', kind: 'case', names: ['骨董盆は隠せない'], colors: ['赤'], caseLevel: 7,
  caseTraits: [], traits: [], rarity: 'C', imageUrl: '1783904159486979.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
export const B10061P: CardDef = { ...B10061, id: 'B10061P', no: '1120/B10061P', rarity: 'CP', imageUrl: '1783904159494437.jpg' };
