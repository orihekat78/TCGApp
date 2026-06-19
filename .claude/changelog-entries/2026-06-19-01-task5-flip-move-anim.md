# Task5 — 現場カードの FLIP 移動アニメ (CPU可視化機能の polish 完了)

**Round/Phase**: 2026-06-19 「人間vsCPU 操作可視化 + 割り込みロック」の残 Task5 (polish)。
core (Task1-4) + BUG-151 は main 取込み済 (1e3dcc80)。本 Task で機能セットを完了。

## 追加: useFlipAnimation hook (engine 変更 0、UI 層のみ)

現場 (scene) のカードがレイアウト reflow で「瞬間移動」するのを滑らかなスライドに変える FLIP
(First-Last-Invert-Play) を導入。flex 子の並び替え (キャラ追加 / 除去 / スイッチ) は position の
変化で transform ではないため、既存の `transition: transform 0.3s` だけでは何もアニメしなかった。

- **新規** `src/ui/hooks/useFlipAnimation.ts`: `.board-content` 配下の `[data-flip-id]` を計測し、
  前回との中心点差分を一旦 invert transform で打ち消し → 次フレームで解除して CSS transition に乗せる。
- **MutationObserver 駆動** (React dep ではなく): 除去カードは 420ms の「ゴースト」として残り、その
  消滅は SceneArea 内部 state で起きる。dep=gameState では最終位置への詰め直しを検知できず瞬間移動に
  なるため、childList の構造変化 (追加/除去/並び替え/ゴースト消滅) を監視して毎回 FLIP を回す。
- **このコードベース固有の補正**: ① `.board-content` の CSS `zoom` (BUG-150) に合わせ差分を zoom で割る。
  ② sleep=rotate(-90) / stun=rotate(180) / pop=scale の CSS transform を clobber しないよう computed
  matrix を合成 (`translate(dx,dy) <matrix>`)。回転に強い「中心点」計測。
- `src/ui/components/SceneArea.tsx`: 実カードのみ `data-flip-id` 付与 (ゴーストは leave アニメ専任で除外)。
- `src/ui/components/Playmat.tsx`: `.board-content` に boardRef + `useFlipAnimation(boardRef)`。

スコープは「reflow 移動トゥイーン」のみ (ユーザー確認済)。推理=タップ横向き / 登場ポップ は既存 CSS
(`.sleep` rotate + `scene-card-enter` + Task2 ぴこんポップ) で動作済のため対象外。アニメ度=標準・MasterDuel風。

## 検証

- TDD: 純関数 `rectCenter` / `computeFlipMoves` (zoom 補正・threshold・新規/退場 skip・中心点) を
  `tests/ui/hooks/useFlipAnimation.test.ts` で 12 件先行 RED→GREEN。
- 実機 e2e `tests/e2e/task5-flip-reflow.spec.ts` 2 件: ① reflow で生存カードに invert→clear が適用され
  実位置が左詰めされる、② **sleep カードが回転を保ったままスライド** (invert に translate + 回転 matrix
  が合成され、settle 後も sleep クラス保持) — 敵対レビューが指摘した合成順の懸念を実機で閉じた。
- tsc 0 / full vitest 2658 pass (+12) / 既存 scene・contact・reasoning e2e 6 件 回帰なし /
  custom lint 7 本 errors=0 / smoke は engine 不変のため不影響。
