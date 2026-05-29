# 作業ログ — 名探偵コナンTCG プロジェクト

> memory.md は現セッション scratchpad。80 行超過時に `.claude/sessions/YYYY-MM-DD.md` へ退避。
> 過去ログ: `.claude/sessions/` (直近: 2026-05-29 = Phase 15/16, 2026-05-28 = Phase 10-14, 2026-05-23 = BUG-064〜077)

## 現在地 (2026-05-29 時点)

- **Phase 17 完了** — チュートリアルに実対戦フォーマット流用 + 横向き事件カード + ワイド2ペイン + 章ごとガイド付き実戦 (meta-app)
  - 詳細: `CHANGELOG.md` Phase 17 / spec `meta-ui/16-tutorial-real-board.md`
  - 新規: `AnnotatedCard.tsx` (実カード拡大+region強調, 事件116:84横) / `TutorialBoardSnapshot.tsx` (FitScaleBox+実Playmat) / `boardHints.ts` / `util/tutorialResolvers.ts`
  - ガイド実戦: viewer ch3+ CTA → `useTutorialStore.setState({currentStep})` + customGameStart → RealMatchView 既存 `<TutorialOverlay/>` 表示。overlay reset は非ガイド起動側(startPractice/SetupScreen)で決定的に (StrictMode で unmount cleanup は不可)
  - tsc green / e2e 29/29 緑 / src/ git diff 0 / Playwright 実機で region 正対応・横事件・ガイド overlay 確認
- **Phase 16 完了** — ステップ→別画面 lesson viewer (33 図解 / ページめくり / Workflow 監査 15 finding)。spec `meta-ui/15`

## 継続中の不変条件 (meta-app 作業)

- `src/` 配下 1 行も変更しない (import 経由のみ、`git status -- src/ vite.config.ts tsconfig.json tests/` = 0 で確認)
- Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)
- meta-app は port 5174 独立 (`npm run dev:meta` / `build:meta` / `test:meta:e2e`)、localStorage namespace `conan.meta.v1.*`
- カード画像非同梱・公開ホスティング禁止 (法務スタンス)
- tsc は `npx tsc --noEmit -p meta-app/tsconfig.json` (root `npm run typecheck` は src/ 用)

## 持ち越し (Phase 17+)

- 動的 unlock (章チェーン) / 各ステップ末クイズ / 練習試合中 src/ TutorialOverlay active 化
- 章別練習シナリオ / viewer スワイプ操作 / バンドル分割
- engine 側: BUG-078 (effectPickResolve re-queue 未実装) — `.claude/bugs/` 参照
