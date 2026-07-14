import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  condition: { kind: 'bond', cardName: '黒羽盗一' }, limit: { kind: 'turn', n: 1 }, cost: { kind: 'sleepSelf' },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'either', max: 1, bind: '$host', filter: { hasSetCards: true } } },
    { kind: 'setCardToEvidence', hostUid: '$host.uid' },
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1 } },
  ] },
  description: '【絆 黒羽盗一】【宣言】【ターン1】【スリープ】：キャラにセットされているカードを1枚選び、持ち主はそのカードを表向きで証拠として得る。そうした場合、キャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'partnerColor', color: '白' },
  effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } }] },
  description: '【パートナー白】【登場時】カードを2枚引き、手札を2枚リムーブする。', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
export const B02039: CardDef = {
  id: 'B02039', no: '0206/B02039', kind: 'character', names: ['工藤優作'], colors: ['白'], level: 8, ap: 8000, lp: 2, traits: ['小説家'], keywords: [], rarity: 'SR', imageUrl: '1721357230951279.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
