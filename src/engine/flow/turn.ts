// engine.flow.turn — Turn-level wrappers (Phase 4 補完)
// spec: .claude/specs/engine-api-flow-control.md
// rules: 05-turn-phases.md, 15-abilities-effects.md
//
// 設計メモ:
//   - startTurn  / endTurn / startMainPhase の薄いラッパー
//   - エンドフェイズの「ターン終了時能力」(rules/05) を発火させる窓として
//     phase:end:start → phase:end:cleanup → turn:end の順で emit する
//   - phase:end:cleanup は D08003 「ターン終了時手札に戻る」等の listener が
//     反応する清掃窓 (turnEffects.removeOnTurnEnd 等のクリーンアップ前)
//   - 呼出元 (UI / CPU driver) が phase:end:start emit 後に
//     engine.resolve.runAllUntilEmpty を回してターン終了時 trigger を解決する責務を持つ。
//     ここでは "Hook を順序通り emit する" だけに留める。
//   - turn.number の繰上げと turn.player の入替は endTurn 内で行う。

import type { GameState } from '../types/index.js';
import { event } from '../event/index.js';
import { runAutoPhase } from './auto-phase.js';
import { scene as sceneMutator } from '../mutate/scene.js';
import { char as charMutator } from '../mutate/char.js';

type Player = 'self' | 'opp';

/**
 * ターン開始: turn:start を emit → オートフェイズ実行 → phase:main:start を emit。
 *
 * rules/05:
 *   - オートフェイズ (パートナー active / キャラ active / ドロー / FILE)
 *   - メインフェイズ突入
 */
export function startTurn(state: GameState, p: Player): void {
  event.emit(state, 'turn:start', { player: p, turnNo: state.turn.number }, undefined);
  runAutoPhase(state, p);
  state.turn.phase = 'main';
  event.emit(state, 'phase:main:start', { player: p }, undefined);
}

/**
 * メインフェイズ開始 (再エントリ用): startTurn から自動的に呼ばれるが、
 * 単独で呼出して phase:main:start のみ emit したい場合に使用する。
 */
export function startMainPhase(state: GameState, p: Player): void {
  state.turn.phase = 'main';
  event.emit(state, 'phase:main:start', { player: p }, undefined);
}

/**
 * ターン終了処理 (rules/05 エンドフェイズ):
 *   1. phase:main:end (メインフェイズ終了)
 *   2. phase:end:start (エンドフェイズ開始 — ターン終了時能力発火窓)
 *   3. [呼出元の責務] resolve.runAllUntilEmpty でターン終了時 trigger 解決
 *   4. phase:end:cleanup (turnEffects 等クリーンアップ窓)
 *   5. 名乗り状態の解除 (rules/11: 「同ターン内に登場した」キャラ限定)
 *   6. turn:end (ターン完全終了直前)
 *   7. turn.number++ & turn.player を入替 (次ターンへ)
 */
export function endTurn(state: GameState, p: Player): void {
  state.turn.phase = 'end';
  event.emit(state, 'phase:main:end', { player: p }, undefined);
  event.emit(state, 'phase:end:start', { player: p }, undefined);
  // 呼出元はここで engine.resolve.runAllUntilEmpty を回す責務を持つ
  // (Phase 5 で「ターン終了時」trigger が積まれる)
  event.emit(state, 'phase:end:cleanup', { player: p }, undefined);
  // Task D E4 (2026-06-12): removeOnTurnEnd / toDeckBottomOnTurnEnd の consume。
  // typed flag removeOnTurnEnd は従来 writer/consumer ゼロ (コメントのみ) だった正規実装。
  // 「ターン終了時、このキャラをリムーブする」(B09032) → removeToRemove (leave:to-remove 発火 ✓ rules/17)
  // 「ターン終了時、このキャラを現場からデッキの下に移す」(PR181/B07079) → scene.toDeck (rules/16 清掃込み)
  // 挿入位置: phase:end:start trigger (①能力発動) の後・clearTurnEffects (②効果切れ) の前 (rules/05)。
  // iterate 中の splice を避けるため uid を snapshot してから処理する。
  for (const player of ['self', 'opp'] as const) {
    const consumed = state.players[player].scene
      .filter(c => c.turnEffects.removeOnTurnEnd === true || c.turnEffects['toDeckBottomOnTurnEnd'] === true)
      .map(c => ({ uid: c.uid, toRemove: c.turnEffects.removeOnTurnEnd === true }));
    for (const { uid, toRemove } of consumed) {
      if (toRemove) {
        sceneMutator.removeToRemove(state, uid, 'effect');
      } else {
        sceneMutator.toDeck(state, uid, 'bottom');
      }
    }
  }
  // 名乗り (isNamed) 解除: ターン p のオーナーの scene キャラに対して。
  // rules/11 (推理): 「同ターン内に登場したキャラ」 = 名乗り状態 → ターン終了で解除されるべき。
  // Phase 6 時点で clearNamed mutator は実装済だが呼出箇所が存在せず、結果として
  // 全キャラが永続的に名乗り状態となり、推理リソースが partner 1 枚に固定されていた。
  for (const c of state.players[p].scene) {
    if (c.isNamed) sceneMutator.clearNamed(state, c.uid);
  }
  // BUG-092: turn-scope 効果 (apMod_turn / lpMod_turn / apMod_contact / lpMod_contact /
  // grantedKeywords) を turn 終了で解除。clearTurnEffects は実装済だが呼出が無く、
  // 「ターン終了時まで突撃[事件]を持たせる」等の付与が永続していた。現ターンで付与された
  // 効果は両プレイヤーの scene キャラに乗りうるため両者を清掃する (phase:end:cleanup 窓)。
  for (const player of ['self', 'opp'] as const) {
    for (const c of state.players[player].scene) {
      charMutator.clearTurnEffects(state, c.uid, 'turn');
    }
    // engine additive wave-8 (2026-07-02, P15): 「このターン中に【疾風】発動」記録をターン境界で解除。
    // primary 清掃 (両プレイヤー分)。resetTurnFlags は driver 層で backstop。turnState 直リセットは
    // hiramekiSuppressed が state-machine action-end で直接クリアするのと同じ posture (driver 非依存)。
    state.turnState[player].shippuFiredThisTurn = false;
  }
  // BUG-101: 'opp-turn' scope (D11005 挑発 mustBeTargeted) は「相手のターン終了時まで」。
  // p のターン終了時、相手 (非p=設定者) の scene の opp-turn 効果を清掃する
  // (設定者から見て「相手のターン (= p のターン) が終了した」= 解除タイミング)。
  const oppOfP: Player = p === 'self' ? 'opp' : 'self';
  for (const c of state.players[oppOfP].scene) {
    charMutator.clearTurnEffects(state, c.uid, 'opp-turn');
  }
  event.emit(state, 'turn:end', { player: p }, undefined);
  // ターン情報の繰上げ
  state.turn.number += 1;
  state.turn.player = p === 'self' ? 'opp' : 'self';
}
