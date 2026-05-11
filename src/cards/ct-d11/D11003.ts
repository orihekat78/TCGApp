// cards/ct-d11/D11003 萩原千速 (キャラ)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
// spec: .claude/specs/cards-analysis/D11003.md
//
// 公式テキスト:
//   【疾風】自分は証拠を1つ得る。
//   【事件婚活パーティー】【宣言】【スリープ】:AP6000以下を1枚まで選びリムーブ。警察2枚以上で宣言可。
//   【ヒラメキ】キャラを1枚まで選び、アクティブにする。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { caseTraitConditioned } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { enterOrder?: number })?.enterOrder === 1,
  },
  effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
  description: '【疾風】自分は証拠を1つ得る。',
  ruleRefs: ['rules/17-icons.md'],
};

const a2Inner: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  condition: {
    kind: 'sceneHas',
    query: { area: 'scene', side: 'self', filter: { trait: '警察' } },
    nMin: 2,
  },
  effect: {
    kind: 'choice', chooser: 'self',
    options: [{
      kind: 'atom', verb: 'sceneRemove',
      args: {
        uid: '$pick', cause: 'effect',
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'either', filter: { apMax: 6000 } },
          n: { min: 0, max: 1 }, chooser: 'self',
        },
      },
    }],
  },
  description: '【宣言】【スリープ】AP6000以下のキャラを1枚まで選び、リムーブする。警察2枚以上で宣言可。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
const a2 = caseTraitConditioned({ trait: '婚活', inner: a2Inner });

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-flash',
  scope: 'on-evidence',
  effect: {
    kind: 'choice', chooser: 'self',
    options: [{
      kind: 'atom', verb: 'sceneSetState',
      args: {
        uid: '$pick', state: 'active',
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'either' },
          n: { min: 0, max: 1 }, chooser: 'self',
        },
      },
    }],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、アクティブにする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const D11003: CardDef = {
  id: 'D11003',
  no: '0936/D11003',
  kind: 'character',
  names: ['萩原千速'], colors: ['黄'],
  level: 8, ap: 8000, lp: 1,
  traits: ['警察', '神奈川県警'], keywords: [],
  rarity: 'D', imageUrl: '1775608962430700.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
