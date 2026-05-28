// engine.mutate.flag — ターンフラグ操作プリミティブ
// rules: 05-turn-phases.md, 12-next-hint.md, 13-keywords.md (アシスト)
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * 手札の使用フラグを設定 (rules/05 1ターン1回制限)
 */
function setHandUseUsed(s: GameState, p: Player, v: boolean): void {
  s.turnState[p].handUseUsed = v;
}

/**
 * ネクストヒント使用フラグを設定 (rules/12)
 */
function setNextHintUsed(s: GameState, p: Player, v: boolean): void {
  s.turnState[p].nextHintUsed = v;
}

/**
 * アシスト済みフラグを設定 (rules/13 アシスト)
 */
function setAssistedThisTurn(s: GameState, p: Player, v: boolean): void {
  s.turnState[p].assistedThisTurn = v;
}

/**
 * 宣言能力使用カウントをインクリメント (rules/21, 17 【ターン①】等)
 * uid: SceneCharacter の uid, abilId: 能力 ID
 */
function incrDeclaredUseCount(s: GameState, uid: string, abilId: string): void {
  // BUG-067: 事件カード (case:self / case:opp) の declared ability にも対応
  if (uid === 'case:self' || uid === 'case:opp') {
    const p: Player = uid === 'case:self' ? 'self' : 'opp';
    const c = s.players[p].case;
    const current = c.declaredUseCount[abilId] ?? 0;
    c.declaredUseCount[abilId] = current + 1;
    return;
  }
  for (const p of ['self', 'opp'] as const) {
    const char = s.players[p].scene.find(c => c.uid === uid);
    if (char) {
      const current = char.declaredUseCount[abilId] ?? 0;
      char.declaredUseCount[abilId] = current + 1;
      return;
    }
  }
}

/**
 * ターン終了時に全フラグをリセット (rules/05 エンドフェイズ)
 */
function resetTurnFlags(s: GameState, p: Player): void {
  s.turnState[p].handUseUsed = false;
  s.turnState[p].nextHintUsed = false;
  s.turnState[p].assistedThisTurn = false;
  s.turnState[p].enterCountThisTurn = 0; // rules/17 §【疾風 N】用 counter リセット
  s.turnState[p].declaredAbilityUseCount = {};
  // BUG-067 (2026-05-28): declared ability の【ターン①/②】 enforcement のため、
  // SceneCharacter / Case の declaredUseCount もターン境界でリセット。
  // (現状 4 カードのみ limit:'turn' を使用、'game' kind は未使用なので turn 単位リセットで全カード正常)
  for (const ch of s.players[p].scene) {
    ch.declaredUseCount = {};
  }
  s.players[p].case.declaredUseCount = {};
}

export const flag = {
  setHandUseUsed,
  setNextHintUsed,
  setAssistedThisTurn,
  incrDeclaredUseCount,
  resetTurnFlags,
};
