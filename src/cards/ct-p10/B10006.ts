import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({ color: '青', kw: '突撃', abilityId: 'a1' });
const a2: AbilityDef = { id: 'a2', type: 'continuous', scope: 'on-scene', continuousModifier: { noAutoActivateSelf: true }, description: 'このキャラはオートフェイズにアクティブにならない。', ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md'] };
const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 2 },
  trigger: { hook: 'hand:reveal', matcherCondition: { kind: 'or', cs: [
    { kind: 'triggerRevealMatches', side: 'self', byPlayer: 'self', cause: 'effect', cardName: ['工藤新一', '毛利蘭'] },
    { kind: 'triggerRevealMatches', side: 'self', byPlayer: 'self', cause: 'cost', cardName: ['工藤新一', '毛利蘭'] },
  ] } },
  condition: { kind: 'and', cs: [{ kind: 'fileAtLeast', n: 5 }, { kind: 'turn', player: 'self' }, { kind: 'caseColor', color: ['青', '黒'], combine: 'and' }] },
  effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } }, { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } }] },
  description: '【FILE5】【自分ターン中】【ターン2】自分のキャラの能力や【宣言】能力のコストによって、手札から〚カード名［工藤新一］〛か〚カード名［毛利蘭］〛を公開したとき、このキャラをアクティブにする。ターン終了時までこのキャラはAP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10006: CardDef = { id: 'B10006', no: '1068/B10006', kind: 'character', names: ['毛利蘭'], colors: ['青'], level: 7, ap: 6000, lp: 0, traits: ['高校生', '毛利探偵事務所', '空手家'], keywords: [], entersSleep: true, rarity: 'R', imageUrl: '1783904055297502.jpg', abilities: [a1, a2, a3], ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'] };
