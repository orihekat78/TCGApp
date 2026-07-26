// CT-P10 B10031 箕輪奨兵 — rules: 08-contact, 10-action-event, 15-abilities-effects, 17-icons
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
  condition: { kind: 'and', cs: [
    { kind: 'turn', player: 'self' },
    { kind: 'charTurnEffect', key: 'removedOpponentByContactThisTurn' },
  ] },
  effect: { kind: 'atom', verb: 'sceneToEvidence', args: { uid: '$self', faceUp: true } },
  description: '自分のターン終了時、このターン中に相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされていて、このキャラが現場にいる場合、このキャラを表向きのまま証拠として得る。',
  ruleRefs: ['rules/08-contact.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1, target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' } } },
    { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
  ] } },
  description: '【登場時】手札からキャラを1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B10031: CardDef = {
  id: 'B10031', no: '1092/B10031', kind: 'character', names: ['箕輪奨兵'], colors: ['緑'], level: 5, ap: 5000, lp: 0,
  traits: ['俳優'], keywords: [], rarity: 'C', imageUrl: '1783904116889974.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/08-contact.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
