// cards/ct-d11/D11005 横溝重悟 (キャラ)
// rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
// spec: .claude/specs/cards-analysis/D11005.md
//
// 公式テキスト:
//   【事件婚活パーティー】【登場時】このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。
//   【宣言】【スリープ】:相手のターン終了時までこのキャラは
//     「相手の現場にいるキャラがアクションするとき、このキャラを指定できる場合、必ず指定する。」を持つ。
//
// G24: apMaxSource で解決時の実効APを参照する。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '../_shared/index.js';

// apMaxSource は解決時の source uid から実効APを読む。継続効果・turn effectも含む。
const a1Inner: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    // このキャラの実効AP以下のキャラを1枚まで選び、リムーブする。
    kind: 'atom', verb: 'sceneRemove',
    args: {
      player: 'self', max: 1, side: 'either', cause: 'effect',
      filter: { kind: 'character', apMaxSource: true },
    },
  },
  description: '【登場時】このキャラのAP以下のAPのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a1 = caseTraitConditioned({ trait: '婚活パーティー', inner: a1Inner });

// a2 宣言+sleepSelf → 挑発: mustBeTargeted = true (opp-turn 終了まで)
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  // 相手のターン終了時までこのキャラは「アクション対象に必ず指定される」(挑発) を持つ
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'mustBeTargeted', val: true, scope: 'opp-turn' } },
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
