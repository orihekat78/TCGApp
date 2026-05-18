// Round 2 — 手札カードが「使えない理由」を人間可読文字列で返すヘルパ
//
// 用途: HandZone collapsed/expanded で「コスト 8 が出てる」「色が違う」「もう使った」など
// disabled 状態の理由を tooltip / title 属性で表示するため。
//
// engine 側 canHandUseCard (src/engine/flow/main/hand-use-card.ts) と同じ
// 判定ロジックを順序通り評価し、最初に該当した理由を返す。
//
// rules: 05-turn-phases.md §手札の使用 / 12-next-hint.md §レベル制限 /
//        20-color-and-switch.md §色制限

import type { GameState } from '@/engine/types/game-state.js';
import { def as readDef } from '@/engine/read/def.js';

type Player = 'self' | 'opp';

/**
 * カードが使用不可な場合の理由を日本語で返す。
 * 使用可能な場合は null。
 *
 * 評価順序 (engine.canHandUseCard と同じ):
 *   1. 手札に存在するか
 *   2. 1 ターン 1 回制限 (turnState.handUseUsed)
 *   3. ネクストヒント済 (turnState.nextHintUsed)
 *   4. 色制限 (rules/20)
 *   5. レベル制限 (rules/12 — FILE 枚数以下)
 *   6. 現場上限 5 (キャラの場合)
 */
export function getHandUseDisabledReason(
  state: GameState,
  player: Player,
  cardId: string,
): string | null {
  // 1. 手札にあるか
  if (!state.players[player].hand.includes(cardId)) {
    return '手札に存在しません';
  }

  // 2. 1 ターン 1 回制限
  if (state.turnState[player].handUseUsed) {
    return '手札の使用は 1 ターン 1 回までです (今ターンは使用済)';
  }

  // 3. ネクストヒント済
  if (state.turnState[player].nextHintUsed) {
    return 'ネクストヒント実行後は手札を使用できません';
  }

  const d = readDef.card(cardId);
  if (!d) return null; // 未登録は寛容 (使用可能扱い)

  // 4. 色制限
  const caseColors = state.players[player].case.colors;
  if (d.colors.length > 0) {
    for (const c of d.colors) {
      if (!caseColors.includes(c)) {
        return `カードの色 (${d.colors.join('/')}) が事件の色 (${caseColors.join('/')}) と一致しません`;
      }
    }
  }

  // 5. レベル制限 (FILE 枚数)
  if (d.level !== undefined) {
    const fileCount = state.players[player].file.length;
    if (d.level > fileCount) {
      return `カードのレベル ${d.level} が FILE 枚数 ${fileCount} を超えています (FILE を ${d.level} 枚以上にする必要があります)`;
    }
  }

  // 6. 現場上限 (キャラのみ)
  if (d.kind === 'character' && state.players[player].scene.length >= 5) {
    return '現場が 5 枚埋まっているためキャラを登場させられません (スイッチ機能で既存キャラと交換可能)';
  }

  return null;
}
