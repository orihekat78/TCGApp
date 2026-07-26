// CT-P10 B10095 ベルモット
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';
const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'caseColor', color: ['青', '黒'], combine: 'and' }, { kind: 'caseStatus', status: '事件編' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { kind: 'character', cardName: ['工藤新一', '毛利蘭'] } }, nMin: 1 }] }, trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
  description: '自分の現場に工藤新一か毛利蘭がいる場合、キャラを1枚までスリープする。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '青' }, { kind: 'caseStatus', status: '解決編' }, { kind: 'fileAtLeast', n: 5 }] },
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 }] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, bind: '$matched', filter: { kind: 'character', levelMax: 5, cardName: ['工藤新一', '毛利蘭'] } } },
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$matched.uid', delta: 1000, scope: 'turn' } },
  ] }, description: 'リムーブのレベル5以下の工藤新一か毛利蘭を登場させ、ターン終了時までAP＋1000する。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
export const B10095: CardDef = {
  id: 'B10095', no: '1150/B10095', kind: 'character', names: ['ベルモット'], colors: ['黒'], level: 6, ap: 5000, lp: 1, traits: ['黒ずくめの組織'], keywords: [], rarity: 'C', imageUrl: '1783904232380404.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
