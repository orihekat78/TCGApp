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

// engine E3 P10 (2026-07-03): 「自分の【黒】のパートナーの【事件解決】を書き換える」(B03135/B05118/B06105)。
// 自 case card の継続能力 continuousModifier.partnerSolveOverride を走査 (type==='continuous' + ability.condition honor)。
// partnerColor 黒 gate は ability.condition ({kind:'partnerColor',color:'黒'}) で表現 → evalCond が honor (cannotSolveCase 同型)。
// ※ partnerColor eval は partnerColorsOverride (別 field) を読むが、その scan は partnerColorsOverride 宣言 ability のみ
//    走査 (cond/eval.ts) → partnerSolveOverride とは disjoint、相互再帰なし。両 field 併存 case は黒 gate を override 色で
//    評価 (無害)。現 3 card (B03135/B05118/B06105) は黒単色・override なしで非該当。
// 有効時、mutate.partner.solveCase が 証拠リムーブ + alt-lose 決着へ差し替わる。不在時 false (baseline 不変)。
function partnerSolveOverride(s: GameState, p: 'self' | 'opp'): boolean {
  const caseId = s.players[p].case.cardId;
  if (!caseId) return false;
  const caseDef = def.card(caseId);
  if (!caseDef) return false;
  const ctx = { source: { player: p, area: 'case', cardId: caseId }, bindings: {} } as unknown as EffectCtx;
  for (const ab of caseDef.abilities ?? []) {
    if (ab.type !== 'continuous') continue;
    if (ab.continuousModifier?.partnerSolveOverride !== true) continue;
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
/**
 * Common partner action gate. A partner slot is not a partner card until setup
 * initializes its cardId; the state factory deliberately leaves that slot
 * active/in-area for ergonomic fixtures, so identity must be checked here.
 */
function canPartnerAct(s: GameState, p: 'self' | 'opp'): boolean {
  const playerState = s.players[p];
  if (s.gameResult !== undefined) return false;
  if (s.turn.player !== p) return false;
  if (s.turn.phase !== 'main') return false;
  if (!playerState.partner.cardId) return false;
  if (playerState.partner.state !== 'active') return false;
  if (playerState.partner.location !== 'partner-area') return false;
  return true;
}

/** Card-defined FILE threshold for the built-in partner assist. */
function partnerAssistFileThreshold(s: GameState, p: 'self' | 'opp'): number {
  const cardId = s.players[p].partner.cardId;
  const threshold = cardId ? def.card(cardId)?.partnerAssistFileThreshold : undefined;
  return threshold ?? 7;
}

/** Common 【アシスト】 availability shared by UI, public dispatch, and AI. */
function canPartnerAssist(s: GameState, p: 'self' | 'opp'): boolean {
  if (!canPartnerAct(s, p)) return false;
  return !s.turnState[p].assistedThisTurn;
}

/** Common 【事件解決】 availability shared by UI, public dispatch, and AI. */
function canPartnerSolveCase(s: GameState, p: 'self' | 'opp'): boolean {
  const playerState = s.players[p];
  if (!canPartnerAct(s, p)) return false;
  if (playerState.case.status !== '解決編') return false;
  if (playerState.evidence.length < playerState.case.requiredEvidence) return false;
  // アシストしたターンは事件解決できない (rules: 01-victory-conditions.md)
  if (s.turnState[p].assistedThisTurn) return false;
  // E3 P53: 「自分は【事件解決】できない」case (B09107) は通常勝利ルート封鎖 (alt-lose のみ残す)
  if (cannotSolveCase(s, p)) return false;
  return true;
}

function canWin(s: GameState, p: 'self' | 'opp'): boolean {
  const playerState = s.players[p];
  if (playerState.case.status !== '解決編') return false;
  if (playerState.evidence.length < playerState.case.requiredEvidence) return false;
  if (playerState.partner.state !== 'active') return false;
  if (playerState.partner.location !== 'partner-area') return false;
  if (s.turnState[p].assistedThisTurn) return false;
  return !cannotSolveCase(s, p);
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
  canPartnerAssist,
  partnerAssistFileThreshold,
  canPartnerSolveCase,
  cannotSolveCase,
  partnerSolveOverride,
  evidenceShortfall,
  refreshCount,
  result,
};
