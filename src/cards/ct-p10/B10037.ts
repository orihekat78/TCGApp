// CT-P10 B10037 京極真 — rules: 08-contact, 09-cutin-disguise, 15-abilities-effects, 17-icons, 21-declared-ability-cost
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { cardNameNot: '京極真', apMin: 10000 }, excludeSource: true } },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 4000, scope: 'turn' } },
  ] } },
  description: '相手の現場にいるキャラが自分の現場にいる〚カード名［京極真］〛以外のAP10000以上のキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラをAP＋4000する。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'and', cs: [
    { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
    { kind: 'charMatches', ref: { kind: 'self' }, filter: { apMin: 10000 } },
    { kind: 'charTurnEffect', key: 'removedOpponentByContactThisTurn' },
  ] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  ] },
  description: '【事件緑＆白】【宣言】【ターン1】カードを1枚引き、このキャラをアクティブにする。この能力はこのキャラがAP10000以上で、このターン中に相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされていた場合に宣言できる。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10037: CardDef = {
  id: 'B10037', no: '1097/B10037', kind: 'character', names: ['京極真'], colors: ['白'], level: 7, ap: 6000, lp: 0,
  traits: ['高校生', '空手家'], keywords: ['突撃'], rarity: 'R', imageUrl: '1783904137956037.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10037P: CardDef = { ...B10037, id: 'B10037P', no: '1097/B10037P', rarity: 'RP', imageUrl: '1783904137967628.jpg' };
