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
 * player: BUG-112 — selfToDeckBottom 等で source が場外へ出ているとき (scene/case 不在) の
 *   fallback 記録先 player。場上で見つかれば不要 (char object に記録)。
 */
function incrDeclaredUseCount(s: GameState, uid: string, abilId: string, player?: Player): void {
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
  // MR partner-area (rules/18/21): PA 常駐 MR の宣言能力【ターン①】カウントは slot object に載せる
  // (read.char.declaredUseCount が scene.byUid 経由で同 slot を読む)。これ無しだと once-per-game 化。
  for (const p of ['self', 'opp'] as const) {
    const slot = s.players[p].partnerAreaMR;
    if (slot && slot.uid === uid) {
      slot.declaredUseCount[abilId] = (slot.declaredUseCount[abilId] ?? 0) + 1;
      return;
    }
  }
  // BUG-112: off-board uid (コスト selfToDeckBottom 等で scene 離脱済) は char object が無いため、
  // player 単位 turnState.declaredAbilityUseCount[uid:abilId] に fallback 記録する。
  // per-instance (uid 単位) の意味は維持 (複数コピーは別 uid)。read.char.declaredUseCount が同 key を参照。
  // turnState は resetTurnFlags でターン境界クリアされるため【ターン①】の turn-scope と整合。
  if (player) {
    const rec = s.turnState[player].declaredAbilityUseCount as Record<string, number>;
    const key = `${uid}:${abilId}`;
    rec[key] = (rec[key] ?? 0) + 1;
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
  s.turnState[p].eventUseBanned = false; // B09034 §M3: 「このターン中イベント使用不可」をターン境界で解除
  s.turnState[p].nextHintBanned = false; // wave use-restrict: 「このターン中ネクストヒント不可」(B06104/B09019/B09105) をターン境界で解除
  s.turnState[p].hiramekiSuppressed = false; // B06049 cluster8: action-scoped ヒラメキ抑止の backstop (主清掃は action-end)
  s.turnState[p].evidenceGainSuppressed = false; // W6 step7 row70: 単発フラグの backstop (主清掃は gainSelfEvidence の consume-on-read。action-end 清掃はセット前に走る dead code ゆえ書かない)
  s.turnState[p].shippuFiredThisTurn = false; // wave-8 P15: 疾風発動記録の backstop (主清掃は endTurn 両プレイヤー)
  s.turnState[p].shippuWaiveArmed = false; // W6 step4 B09090: 疾風条件 waive 予約の backstop (主清掃は endTurn 両プレイヤー)
  s.turnState[p].cutinBanned = false; // wave-10 B07002: 「このターン中カットイン使用不可」をターン境界で解除
  s.turnState[p].disguiseBanned = false; // wave-10 B07002: 「このターン中変装使用不可」をターン境界で解除
  s.turnState[p].declaredAbilityUseCount = {};
  // BUG-067 (2026-05-28): declared ability の【ターン①/②】 enforcement のため、
  // SceneCharacter / Case の declaredUseCount もターン境界でリセット。
  // (現状 4 カードのみ limit:'turn' を使用、'game' kind は未使用なので turn 単位リセットで全カード正常)
  for (const ch of s.players[p].scene) {
    ch.declaredUseCount = {};
  }
  s.players[p].case.declaredUseCount = {};
  // MR partner-area (rules/18): PA 常駐 MR の【ターン①】カウントもターン境界でリセット。
  if (s.players[p].partnerAreaMR) s.players[p].partnerAreaMR.declaredUseCount = {};
}

export const flag = {
  setHandUseUsed,
  setNextHintUsed,
  setAssistedThisTurn,
  incrDeclaredUseCount,
  resetTurnFlags,
};
