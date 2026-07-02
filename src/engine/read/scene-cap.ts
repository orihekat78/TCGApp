// engine.read.sceneCap — 現場登場キャラ枚数の上限 (rules/03 §現場5枚, rules/20 §スイッチ)
// spec: e3-altwin-decomposition-2026-07-02.md (P11)
//
// 既定 5。case card の継続能力 continuousModifier.sceneCapOverride があれば override
// (PR067 探偵の目「自分の現場に置けるキャラの枚数は〚最大4枚まで〛になる」)。
// wave-5 handUseCharRestrictAllows と同流儀: type==='continuous' + ability.condition 成立中のみ有効。
//
// この上限は現場**登場ゲート**にのみ効く (mutate.scene.enter throw / effect sceneEnter switch 判定 /
// canHandUseCard/Switch)。絶対 invariant (sceneAtMost5) は 5 のまま — 既存 5 枚に cap4 が乗っても
// 強制リムーブしない (rules/19 §下限なし に準じた非強制解釈、公式は超過時裁定を明示せず)。
// 不在時 5 (既存 case は未宣言 → baseline 不変)。

import type { GameState, EffectCtx } from '@/engine/types';
import { def } from './def.js';
import { evalCond } from '@/engine/cond/eval.js';

type Player = 'self' | 'opp';

export const DEFAULT_SCENE_CAP = 5;

export function sceneCap(s: GameState, p: Player): number {
  const caseId = s.players[p].case.cardId;
  if (!caseId) return DEFAULT_SCENE_CAP;
  const caseDef = def.card(caseId);
  if (!caseDef) return DEFAULT_SCENE_CAP;
  const ctx = { source: { player: p, area: 'case', cardId: caseId }, bindings: {} } as unknown as EffectCtx;
  for (const ab of caseDef.abilities ?? []) {
    if (ab.type !== 'continuous') continue;
    const ov = ab.continuousModifier?.sceneCapOverride;
    if (ov === undefined) continue;
    if (ab.condition && !evalCond(s, ab.condition, ctx)) continue;
    return ov;
  }
  return DEFAULT_SCENE_CAP;
}
