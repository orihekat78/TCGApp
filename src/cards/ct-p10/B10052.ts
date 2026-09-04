// CT-P10 B10052 羽田秀𠮷
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const blankOriginal = { kind: 'character' as const, hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] };

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: blankOriginal }, nMin: 1 },
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '自分のターン終了時、自分の現場に【カットイン】と【ヒラメキ】以外の元の能力を持たないキャラがいる場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: blankOriginal } },
  condition: { kind: 'turn', player: 'self' },
  effect: { kind: 'atom', verb: 'charModifyLevel', args: { player: 'self', side: 'opp', max: 1, filter: { kind: 'character' }, delta: -1, scope: 'turn' } },
  description: '【自分ターン中】自分の現場に【カットイン】と【ヒラメキ】以外の元の能力を持たないキャラが登場したとき、相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'declared', scope: 'on-scene',
  cost: { kind: 'pay', items: [
    { kind: 'sleepSelf' },
    { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  ] },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 9 }, cause: 'effect' } },
  description: '【宣言】【スリープ】〚手札を1枚リムーブする〛：レベル9以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B10052: CardDef = {
  id: 'B10052', no: '1111/B10052', kind: 'character', names: ['羽田秀𠮷'], colors: ['赤'], level: 8, ap: 8000, lp: 2,
  traits: ['棋士', '赤井家'], keywords: [], rarity: 'R', imageUrl: '1783904159392737.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
export const B10052P: CardDef = { ...B10052, id: 'B10052P', no: '1111/B10052P', rarity: 'RP', imageUrl: '1783904159401913.jpg' };
