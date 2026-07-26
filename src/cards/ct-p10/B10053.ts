// CT-P10 B10053 宮野エレーナ
// rules: 13-keywords.md, 15-abilities-effects.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelIn: [7] }, excludeSelf: true }, nMin: 1 },
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'choice', chooser: 'self', options: [
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 7 }, cause: 'effect' } },
    { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMin: 7 }, kw: 'ブレット', scope: 'turn' } },
  ] },
  description: '【宣言】【ターン1】【スリープ】：以下から1つ選んで行う。この能力は自分の現場にこのキャラ以外のレベル7のキャラがいる場合に宣言できる。・レベル7以下のキャラを1枚まで選び、リムーブする。・レベル7以上のキャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B10053: CardDef = {
  id: 'B10053', no: '1112/B10053', kind: 'character', names: ['宮野エレーナ'], colors: ['赤'], level: 7, ap: 5000, lp: 1,
  traits: ['科学者', '医師'], keywords: [], rarity: 'R', imageUrl: '1783904159409184.jpg', abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
