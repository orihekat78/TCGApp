// CT-P10 B10050 ジョディ・スターリング
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const blankOriginalCharacter = {
  kind: 'character' as const,
  levelMin: 5,
  hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '赤' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'optional', effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 7 }, cause: 'effect' } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ] },
  description: '【パートナー赤】【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene',
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: blankOriginalCharacter }, nMin: 1 },
  cost: { kind: 'pay', items: [
    { kind: 'sleepSelf' },
    { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 },
    { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  ] },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' }, cause: 'effect' } },
  description: '【宣言】【スリープ】〚このキャラをリムーブエリアに移し、手札を1枚リムーブする〛：キャラを1枚まで選び、リムーブする。この能力は自分の現場に【カットイン】と【ヒラメキ】以外の元の能力を持たないレベル5以上のキャラがいる場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10050: CardDef = {
  id: 'B10050', no: '1109/B10050', kind: 'character', names: ['ジョディ・スターリング'], colors: ['赤'], level: 8, ap: 7000, lp: 2,
  traits: ['FBI'], keywords: [], rarity: 'SR', imageUrl: '1783904138087253.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B10050P: CardDef = { ...B10050, id: 'B10050P', no: '1109/B10050P', rarity: 'SRP', imageUrl: '1783904138095639.jpg' };
