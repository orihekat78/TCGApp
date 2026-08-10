// scenePick — scene-char effect pick を「現場カード直接クリック」(Direct Manipulation) で
// 処理できるかの単一述語。Playmat (Part A: 現場ハイライト) と EffectPickerModal (Part B: null-gate)
// が **同一述語を共有** することで「二重 UI」「どの UI も出ない soft-lock」を防ぐ。
//
// 由来: UI picker Direct Manipulation 化 設計 v2 BLOCKER 反映
//       (.claude/specs/ui-picker-direct-manipulation-2026-06-15.md)
// rules: 03-field-areas.md §現場, 15-abilities-effects.md §「〜まで」, 20-color-and-switch.md
//
// 決定論 scan (scripts/tmp-scene-pick-scan.ts, 全カード): EffectPickerModal に落ちる pick は
// 100% scene-char・全て n.max=1。よって本述語が true のとき現場直接クリックで過不足なく処理できる。
// 将来 n.max>1 の scene pick が来たら false → EffectPickerModal が画像付きで描画 (フォールバック成立)。

import type { GameState } from '@/engine/types/game-state';
import type { PendingEffectPick } from '@/ui/state/store';

/**
 * pending を「自分が・1枚だけ・現場キャラから選ぶ」直接操作 pick と判定する。
 *
 * 条件 (すべて満たすとき true):
 *   - player === 'self' (人間が選ぶ)
 *   - nMax === 1 (単一クリックで確定。multi-select UI は SceneArea に無い)
 *   - 候補が1件以上あり、**全候補の uid が self/opp いずれかの現場キャラ uid と一致**
 *     (card/evidence kind の synthetic uid は現場に存在しないため自動的に false → modal フォールバック)
 */
export function isSceneDirectPick(
  pending: PendingEffectPick | null | undefined,
  gameState: GameState | null | undefined,
): boolean {
  if (!pending || !gameState) return false;
  if (pending.player !== 'self') return false;
  if (pending.publicHandRevealToken) return false;
  if (pending.nMax !== 1) return false;
  if (pending.candidates.length === 0) return false;
  const sceneUids = new Set<string>();
  for (const c of gameState.players.self.scene) sceneUids.add(c.uid);
  for (const c of gameState.players.opp.scene) sceneUids.add(c.uid);
  return pending.candidates.every((c) => sceneUids.has(c.uid));
}
