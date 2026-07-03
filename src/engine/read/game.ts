// engine.read.game — ゲーム全体情報セレクタ (純粋関数)
// rules: 01-victory-conditions.md, 14-refresh.md

import type { GameState, EffectCtx, GameResult } from '@/engine/types';
import { def } from './def.js';
import { evalCond } from '@/engine/cond/eval.js';

// engine E3 P53 (2026-07-03): 「自分は【事件解決】できない」(B09107 犯人たちの犯行)。
// 自 case card の継続能力 continuousModifier.cannotSolveCase を走査 (type==='continuous' + ability.condition honor)。
// scene-cap.ts sceneCap / eval.ts partnerColorsOverride と同流儀の case-def-continuous read。
// 不在時 false (既存 case は未宣言 → baseline 不変)。canWin / ai.canSolveCase / ui.canSolveCaseForUi が gate。
function cannotSolveCase(s: GameState, p: 'self' | 'opp'): boolean {
  const caseId = s.players[p].case.cardId;
  if (!caseId) return false;
  const caseDef = def.card(caseId);
  if (!caseDef) return false;
  const ctx = { source: { player: p, area: 'case', cardId: caseId }, bindings: {} } as unknown as EffectCtx;
  for (const ab of caseDef.abilities ?? []) {
    if (ab.type !== 'continuous') continue;
    if (ab.continuousModifier?.cannotSolveCase !== true) continue;
    if (ab.condition && !evalCond(s, ab.condition, ctx)) continue;
    return true;
  }
  return false;
}

// 勝利可能かどうか:
// - 解決編であること
// - 必要証拠数を満たしていること
// - パートナーがアクティブ状態であること (アシスト済みでないこと)
// - 同ターンにアシストしていないこと (rules: 01-victory-conditions.md)
// - case が【事件解決】不可を宣言していないこと (E3 P53、rules: 01)
// rules: 01-victory-conditions.md, 13-keywords.md
function canWin(s: GameState, p: 'self' | 'opp'): boolean {
  const playerState = s.players[p];
  const caseStatus = playerState.case.status;
  if (caseStatus !== '解決編') return false;
  if (playerState.evidence.length < playerState.case.requiredEvidence) return false;
  if (playerState.partner.state !== 'active') return false;
  if (playerState.partner.location !== 'partner-area') return false;
  // アシストしたターンは事件解決できない (rules: 01-victory-conditions.md)
  if (s.turnState[p].assistedThisTurn) return false;
  // E3 P53: 「自分は【事件解決】できない」case (B09107) は通常勝利ルート封鎖 (alt-lose のみ残す)
  if (cannotSolveCase(s, p)) return false;
  return true;
}

// 必要証拠数と現在証拠数の差 (マイナスなら達成済)
function evidenceShortfall(s: GameState, p: 'self' | 'opp'): number {
  const playerState = s.players[p];
  return playerState.case.requiredEvidence - playerState.evidence.length;
}

// リフレッシュ回数
function refreshCount(s: GameState, p: 'self' | 'opp'): number {
  return s.refreshCount[p];
}

// ゲーム結果 (まだ決着していない場合 null)
function result(s: GameState): GameResult | null {
  return s.gameResult ?? null;
}

export const game = {
  canWin,
  cannotSolveCase,
  evidenceShortfall,
  refreshCount,
  result,
};
