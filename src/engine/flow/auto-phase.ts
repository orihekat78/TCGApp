// engine.flow.runAutoPhase — オートフェイズ駆動
// spec: .claude/specs/engine-api-flow-control.md
// rules: 05-turn-phases.md (3フェイズ), 03-field-areas.md (スタン特殊), 04-game-setup.md (先攻初手1枚)
//
// 手順 (rules/05):
//   1. 自分のパートナーをアクティブ
//      - FILE 中ならパートナーエリアへ戻してアクティブ化 (rules/05)
//   2. 自分の現場のキャラをすべてアクティブ
//      - スタン状態のキャラはアクティブにする代わりにスリープになる (rules/03)
//   3. デッキ上から 1枚ドロー (先攻初手もドローする — rules/05)
//   4. デッキ上から FILE に置く
//      - 先攻初手のみ 1 枚
//      - 通常 2 枚
//
// 各ステップは可能でなければスキップ (rules/05 Point)。
//
// Hook 発火タイミング:
//   - phase:auto:start (エントリ時)
//   - phase:auto:before-draw (アクティブ化後)
//   - phase:auto:after-draw (ドロー後)
//   - phase:auto:after-file (FILE 後 / 関数末尾)

import type { GameState } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';

type Player = 'self' | 'opp';

const FILE_ADD_NORMAL = 2;
const FILE_ADD_FIRST_PLAYER_FIRST_TURN = 1;

/**
 * runAutoPhase — オートフェイズの 1 ターン分を実行する。
 *
 * ⚠ Phase 4: 各ステップは状態変更のみ。能力起動 (登場時等) は emit 経由で
 *   pendingEffects に積まれる。実際の解決は呼出元が engine.resolve.runAllUntilEmpty
 *   を呼ぶ責務。
 */
export function runAutoPhase(state: GameState, p: Player): void {
  // phase = 'auto' に揃える (setup の途中から呼ばれた場合のための安全策)
  state.turn.phase = 'auto';

  event.emit(state, 'phase:auto:start', { player: p });

  // 1. パートナーアクティブ化
  const partner = state.players[p].partner;
  if (partner.location === 'file-area') {
    // アシスト中: FILE から partner-area に戻してアクティブ化
    mutate.partner.returnFromFile(state, p);
  } else if (partner.cardId) {
    // 通常: partner-area にいる場合のみアクティブ化 (mr-removed はスキップ)
    if (partner.location === 'partner-area') {
      mutate.partner.setState(state, p, 'active');
    }
  }
  // partner が空 (cardId='') の場合は init されていない → スキップ

  // 2. 現場キャラのアクティブ化
  //    setState/tryActivate は stun 特殊挙動 (active → sleep) を内包
  const sceneUids = state.players[p].scene.map(c => c.uid);
  for (const uid of sceneUids) {
    mutate.scene.tryActivate(state, uid);
  }
  // 2b. MR partner-area (rules/18 + 公式Q&A 反映 2026-06-24): PA 常駐 MR は auto-phase で活性化しない。
  //   rules/05① のアクティブ化対象は「自分のパートナー」と「自分の現場のキャラ」のみで PA-MR はどちらでもない。
  //   さらに事務局裁定 (commmune post/1690545、@DCCG_admin_bk 2025-05-23) は「パートナーエリアにある MR の
  //   状態を変更したり (MR能力以外で) 移動させる方法は存在しない」= PA-MR の state は sticky と明言。
  //   よって PA-MR は移動時の snapshot 状態を保持する (推測でルール補完しない、CLAUDE.md)。slotMr には触れない。

  event.emit(state, 'phase:auto:before-draw', { player: p });

  // 3. 1 枚ドロー (デッキ 0 枚なら mutate.deck.draw が自動リフレッシュ試行 / 失敗時は 0 枚返す)
  const drawn = mutate.deck.draw(state, p, 1);

  event.emit(state, 'phase:auto:after-draw', { player: p, drawn });

  // 4. FILE 追加 (先攻初手のみ 1 枚)
  const isFPFT = state.turn.isFirstPlayerFirstTurn && p === state.turn.player;
  const fileN = isFPFT ? FILE_ADD_FIRST_PLAYER_FIRST_TURN : FILE_ADD_NORMAL;
  mutate.file.addFromDeckTop(state, p, fileN);

  // 先攻初手 flag を解除 (次ターン以降は通常)
  if (isFPFT) {
    state.turn.isFirstPlayerFirstTurn = false;
  }

  event.emit(state, 'phase:auto:after-file', { player: p });
}
