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
}

export const flag = {
  setHandUseUsed,
  setNextHintUsed,
  setAssistedThisTurn,
  incrDeclaredUseCount,
  resetTurnFlags,
};
