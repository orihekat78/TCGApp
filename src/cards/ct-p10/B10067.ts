// CT-P10 B10067 降谷零
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'bond', cardName: '諸伏景光' },
  continuousModifier: { grantKeywords: () => ['text:actionTargetsActive'] },
  description: '【絆諸伏景光】このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' }, condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '伊達航' }, { kind: 'turn', player: 'self' }] },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【絆伊達航】自分のターン終了時、このキャラをアクティブにする。', ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};
const ownTurnAp = (id: string, cardName: string): AbilityDef => ({
  id, type: 'continuous', scope: 'on-scene', condition: { kind: 'and', cs: [{ kind: 'bond', cardName }, { kind: 'turn', player: 'self' }] },
  continuousModifier: { apDelta: 1000 }, description: `【絆${cardName}】【自分ターン中】AP＋1000`, ruleRefs: ['rules/15-abilities-effects.md'],
});

export const B10067: CardDef = {
  id: 'B10067', no: '1123/B10067', kind: 'character', names: ['降谷零'], colors: ['黄'], level: 7, ap: 6000, lp: 1,
  traits: ['警察', '公安'], keywords: ['突撃'], rarity: 'SR', imageUrl: '1783904183399621.jpg',
  abilities: [a1, a2, ownTurnAp('a3', '萩原研二'), ownTurnAp('a4', '松田陣平')],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10067P: CardDef = { ...B10067, id: 'B10067P', no: '1123/B10067P', rarity: 'SRP', imageUrl: '1783904183407595.jpg' };
export const B10067P2: CardDef = { ...B10067, id: 'B10067P2', no: '1123/B10067P2', rarity: 'SRP', imageUrl: '1783904183415213.jpg' };
export const B10067P3: CardDef = { ...B10067, id: 'B10067P3', no: '1123/B10067P3', rarity: 'SRCP', imageUrl: '1783904183422234.jpg' };
