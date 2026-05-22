// ai.policies.state-evaluator — Phase 9-F.2 静的評価関数
//
// spec: .claude/specs/phase-9-f-mcts.md (Out of Scope: 静的評価関数 → 本 Phase で導入)
//
// 役割:
//   - GameState を受け取り「byPlayer 視点での game value」を [-1, +1] で返す
//   - MCTS の partial rollout + evaluation 戦術に使用 (full-game より高速 + safe)
//
// 評価項目 (linear sum, 重み調整可):
//   1. evidence ratio (-1 to +1): (self/required) - (opp/required) で最重要
//   2. file ratio: assist 閾値 7 への到達度 (0..1 each side)
//   3. scene strength: AP + LP 合計差 (normalize 25000)
//   4. partner state: パートナーがスリープなら -0.1
//
// 異常終了: gameResult 確定なら +1/-1/0 をそのまま返す
//
// Phase 9-F.2 次段階: 評価関数 weight の学習 / opening book / endgame DB

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

const WEIGHTS = {
  evidence: 0.7,
  file: 0.1,
  scene: 0.15,
  partner: 0.05,
};

const SCENE_NORMALIZE = 25000; // 5 chars * 5000 AP+LP avg

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function sidePartnerStateScore(state: GameState, p: Player): number {
  const partner = state.players[p].partner;
  return partner.state === 'sleep' ? -1 : 0;
}

function sideSceneStrength(state: GameState, p: Player): number {
  return state.players[p].scene.reduce((sum, c) => {
    const ap = c.apOverride ?? 0;
    const lp = c.lpOverride ?? 0;
    // override が null の場合は def 取得が必要だが、本評価関数は近似で OK
    return sum + ap + lp;
  }, 0);
}

/**
 * デフォルトの状態評価関数。
 * 戻り値: [-1, +1] (byPlayer 視点、+1 が完勝)
 */
export function defaultStateEvaluator(state: GameState, byPlayer: Player): number {
  // 終局判定優先 (winner は 'self' | 'opp' のみ — draw は別の reason で判定)
  if (state.gameResult) {
    if (state.gameResult.winner === byPlayer) return 1;
    return -1;
  }

  const opp: Player = byPlayer === 'self' ? 'opp' : 'self';
  const reqSelf = state.players[byPlayer].case.requiredEvidence ?? 7;
  const reqOpp = state.players[opp].case.requiredEvidence ?? 7;
  const evSelf = state.players[byPlayer].evidence.length;
  const evOpp = state.players[opp].evidence.length;

  // 1. evidence ratio
  const evidenceScore = clamp(evSelf / reqSelf - evOpp / reqOpp, -1, 1);

  // 2. file ratio (assist 閾値 7 への到達度)
  const fileSelf = clamp(state.players[byPlayer].file.length / 7, 0, 1);
  const fileOpp = clamp(state.players[opp].file.length / 7, 0, 1);
  const fileScore = fileSelf - fileOpp;

  // 3. scene strength diff
  const sceneSelf = sideSceneStrength(state, byPlayer);
  const sceneOpp = sideSceneStrength(state, opp);
  const sceneScore = clamp((sceneSelf - sceneOpp) / SCENE_NORMALIZE, -1, 1);

  // 4. partner state diff (sleep = unable to reason/assist/solve)
  const partnerScore = sidePartnerStateScore(state, byPlayer) - sidePartnerStateScore(state, opp);

  const total =
    WEIGHTS.evidence * evidenceScore +
    WEIGHTS.file * fileScore +
    WEIGHTS.scene * sceneScore +
    WEIGHTS.partner * partnerScore;

  return clamp(total, -1, 1);
}

/**
 * 評価関数 interface — 将来カスタム評価関数を MCTSPolicy に注入可能にする。
 */
export type StateEvaluator = (state: GameState, byPlayer: Player) => number;
