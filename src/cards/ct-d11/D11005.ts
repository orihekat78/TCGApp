// cards/ct-d11/D11005 横溝重悟 (キャラ)
// rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
// spec: .claude/specs/cards-analysis/D11005.md
//
// 公式テキスト:
//   【事件婚活パーティー】【登場時】このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。
//   【宣言】【スリープ】:相手のターン終了時までこのキャラは
//     「相手の現場にいるキャラがアクションするとき、このキャラを指定できる場合、必ず指定する。」を持つ。
//
// NOTE (G24 dyn apMax='$self.ap'): TargetFilter.custom で動的比較を吸収。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import type { Candidate } from '@/engine/types';
import { engine } from '@/engine';
import { caseTraitConditioned } from '../_shared/index.js';

// TargetFilter.custom: 動的 apMax (G24 — selfUid は engine.target に渡される source ref 経由想定)。
// 現状 candidate に selfUid を含めないため、apMax=8000 固定で代用 (本カードAP=8000)。
// TODO Phase 5+: targeting context に source uid を伝播し、engine.read.char.ap(s, sourceUid) を参照する。
const a1Inner: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'choice', chooser: 'self',
    options: [{
      kind: 'atom', verb: 'sceneRemove',
      args: {
        uid: '$pick', cause: 'effect',
        target: {
          kind: 'pick',
          query: {
            area: 'scene', side: 'either',
            filter: {
              custom: (s: GameState, cand: Candidate) => {
                if (cand.kind !== 'char') return false;
                const tgtAp = engine.read.char.ap(s, cand.uid);
                return tgtAp <= 8000;
              },
            },
          },
          n: { min: 0, max: 1 }, chooser: 'self',
        },
      },
    }],
  },
  description: '【登場時】このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a1 = caseTraitConditioned({ trait: '婚活', inner: a1Inner });

// a2 宣言+sleepSelf → 挑発: mustBeTargeted = true (opp-turn 終了まで)
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom', verb: 'charSetTurnEffect',
    args: { uid: '$self', key: 'mustBeTargeted', value: true, scope: 'opp-turn' },
  },
  description: '【宣言】【スリープ】相手ターン終了時まで「アクション対象に必ず指定される」(挑発)。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/21-declared-ability-cost.md'],
};

export const D11005: CardDef = {
  id: 'D11005',
  no: '0937/D11005',
  kind: 'character',
  names: ['横溝重悟'], colors: ['黄'],
  level: 8, ap: 8000, lp: 1,
  traits: ['警察', '神奈川県警'], keywords: [],
  rarity: 'D', imageUrl: '1775608962447530.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
