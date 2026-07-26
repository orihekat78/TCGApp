// CT-P10 B10071 山村ミサオ
// rules: 07-action-flow.md, 10-action-event.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, trigger: { hook: 'action:declare' },
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'opp' }, { kind: 'triggerActionKind', v: 'case' }, { kind: 'triggerCharMatches', side: 'opp', filter: {} }] },
  effect: { kind: 'optional', effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } } },
  description: '【相手ターン中】【ターン1】相手の現場にいるキャラがアクション［事件］したとき、このキャラをアクティブにしてもよい。', ruleRefs: ['rules/07-action-flow.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};
const a3: AbilityDef = {
  id: 'a3', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, condition: { kind: 'bond', cardName: '諸伏景光' },
  effect: { kind: 'atom', verb: 'sceneToHand', args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 9 } } },
  description: '【絆諸伏景光】【宣言】【ターン1】相手の現場にいるレベル9以下のキャラを1枚まで選び、手札に移す。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10071: CardDef = {
  id: 'B10071', no: '1127/B10071', kind: 'character', names: ['山村ミサオ'], colors: ['黄'], level: 8, ap: 7000, lp: 0,
  traits: ['警察', '群馬県警'], keywords: [], rarity: 'R', imageUrl: '1783904183473335.jpg', abilities: [misreadX({ x: 3, abilityId: 'a1' }), a2, a3],
  ruleRefs: ['rules/07-action-flow.md', 'rules/10-action-event.md', 'rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10071P: CardDef = { ...B10071, id: 'B10071P', no: '1127/B10071P', rarity: 'RP', imageUrl: '1783904202615703.jpg' };
