// engine.read.game — ゲーム全体情報セレクタ (純粋関数)
// rules: 01-victory-conditions.md, 14-refresh.md

import type { GameState, GameResult } from '@/engine/types';

// 勝利可能かどうか:
// - 解決編であること
// - 必要証拠数を満たしていること
// - パートナーがアクティブ状態であること (アシスト済みでないこと)
// - 同ターンにアシストしていないこと (rules: 01-victory-conditions.md)
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
  evidenceShortfall,
  refreshCount,
  result,
};
