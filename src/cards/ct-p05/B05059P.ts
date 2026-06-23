// cards/ct-p05/B05059P 白馬探 (character, パラレル) — engine拡張 wave removedFilter
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト (B05059 と同一、パラレル = imageUrl/rarity/no のみ差異):
//   【相手ターン中】【ターン1】スリープ状態のこのキャラか自分の現場にいるスリープ状態の〚特徴［探偵］〛のキャラがリムーブされたとき、カードを1枚引く。
//   【宣言】【ターン1】〚このキャラ以外の特徴［探偵］のキャラを1枚スリープさせる〛：AP8000以下のキャラを1枚まで選び、リムーブする。
// 句マッピングは B05059.ts と同一 (standalone full CardDef 慣習)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'opp' },
      { kind: 'removedCharMatches', side: 'self', removedFilter: { trait: '探偵' }, removedState: ['sleep'] },
    ],
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【ターン1】スリープ状態のこのキャラか自分の現場にいるスリープ状態の〚特徴［探偵］〛のキャラがリムーブされたとき、カードを1枚引く。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'sleepChar',
    target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { trait: '探偵' } }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } },
  },
  description: '【宣言】【ターン1】〚このキャラ以外の特徴［探偵］のキャラを1枚スリープさせる〛：AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B05059P: CardDef = {
  id: 'B05059P',
  no: '0561/B05059P',
  kind: 'character',
  names: ['白馬探'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1747231524154540.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
