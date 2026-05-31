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

## 2026-05-30 BUG-085 — 事件宣言能力 flipFaceUpEvidence コスト修正 (user 報告)

- 症状: 事件カードの宣言能力 OK 後に何も起きない。原因 2 層:
  - Layer1 (UI): cost picker 欠落 → `cost.pay` が indices 空で throw → rollback。
  - Layer2 (engine): 効果 delta `{dyn:'$cost...count*1000'}` が未評価 (evalDyn dead code) → AP NaN。
- 修正: useEvidenceFlipPicker (新) + runDeclaredAbilityFlow で証拠 picker (CardListModal 流用) /
  resolve-picks.resolveDynArgs で `{dyn}` literal 化 / useDeclaredAbility に costPaid 引き継ぎ (UI+AI) /
  descriptor `$cost` / read/char.declaredUseCount を `?.` (BUG-084 fixture throw 防御)。
- 検証: 全 1641 test pass + e2e 実機クリック 2 件 (混在 face-up 含む) + 敵対レビュー 13→3 (1 は false positive を e2e で棄却)。
- 詳細: `.claude/bugs/BUG-085.md` / memory `effect-dyn-arg-evaluation`。
- 未: commit 時に `npm run docs` 必須 (新規 src ファイルで structure.md stale)。eslint の test 既存 debt は別件。

## 2026-05-31 BUG-086 / BUG-087 — 証拠表向き pick 不可 / NextHint level off-by-one (user 報告)

- **BUG-086** (中, ui): 証拠に表向きカードがある状態で D08013 evidenceToHand pick が非公開しか選べない。
  - 原因: `CardListModal.tsx` 表向き分岐が `findFaceDownPickUid(idx)` を呼ばず onExpand/静的のみ (BUG-085 で追加時 pick 未配線)。`Playmat.tsx:724` は全 index を pickCands に渡している。
  - 修正: 表向き分岐に pick 判定追加 → pickable button。flip picker は候補=裏向き index のみで影響なし。
  - test: `tests/e2e/bug-086.spec.ts` (修正前 fail / 後 pass)。※ D08013 は level4 → handUseCard に FILE≥4 必要。
- **BUG-087** (中, ui): NextHint step2 が FILE N 枚で level ≤ N を許可 (rules/12「1で抜いた分は数えない」→ −1)。
  - 原因: `useActionsPanelFlow.ts:212` `postPopCount = nonAssistedCount` (− 1 欠落、起源 commit 9380314、BUG-085 無関係)。
  - 修正: `nonAssistedCount - 1`。engine (next-hint.ts post-pop file.length) は元から正しく整合。
  - test: nextHint.test.ts に `postPopCount===2` / Lv3(D08023) 候補外 追加 (既存は Lv2 のみで両しきい値通過し検出できず)。
- 検証: tsc green / vitest **1642 pass** / e2e bug-085・bug-086・effect-pick pass。
- ⚠ **BUG-085 マージ (37bdd6b) 由来の既存 e2e 失敗 2 件**を発見 (私の修正と無関係、clean state でも fail、要別途調査):
  `event-remove-by-ap.spec.ts:231` (D11020 pendingEffects queue) / `replay-ui.spec.ts:98` (close ボタン spectator-hud が pointer 干渉)。

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
