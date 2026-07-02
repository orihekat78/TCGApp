// cards/ct-p08/B08079P ピンガ (パラレル) — B08079 と同型 (a1 + a2 + a3 + a4、a3 = caseColorNot 宣言remove、a4 = 変装)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】AP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a3 = B08079 と同型 (絵柄違い・テキスト同一)。caseColorNot:黒 宣言ゲート + sleepSelf + AP8000以下 sceneRemove。
const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseColorNot', color: '黒' },
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
  description: '【宣言】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の事件が【黒】以外の色を持つ場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

// a4 = B08079 と同型。【変装】ゲート【事件黒】【FILE7】 (BUG-163: col13 grounding 漏れの追補、B02038 a3 同型)。
const a4: AbilityDef = {
  id: 'a4',
  type: 'icon-disguise',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: '黒' },
      { kind: 'fileAtLeast', n: 7 },
    ],
  },
  description: '【変装】【事件黒】【FILE7】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

export const B08079P: CardDef = {
  id: 'B08079P',
  no: '0915/B08079P',
  kind: 'character',
  names: ['ピンガ'],
  colors: ['黒'],
  level: 8, ap: 7000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'SRP',
  imageUrl: '1770878999157246.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
