---
date: 2026-05-28
title: Phase 11 — meta-app (5174) を src/ 実機ゲーム機能と統合
type: feat
scope: meta-app
---

## ユーザー要望

> 5173はそのままで5173と提供UIを統合させた5174を作成してほしかったんですよね

Phase 10 で完成した meta-app (port 5174) は完全独立アプリ・engineStub 模擬対戦だったため、ユーザー意図と齟齬。Phase 11 で `src/` を **完全不変** に保ったまま import 経由で実機エンジン・Playmat・モーダル群を 5174 内に取り込み、5173 体験と等価な実機対戦を 5174 上で成立させた。

## 主要変更 (meta-app/ のみ、~12 ファイル)

- **vite.config.meta.ts**: `@/*` → `../src/*` alias 追加 (既存 `@meta/*` 維持)
- **tsconfig.json**: `paths` に `@/*`, `rootDir: ".."`, `types: ["node", "vite/client"]`, `noUncheckedIndexedAccess: false` (src/ に合わせる)
- **main.tsx**: `registerAll()` を module top で呼出 (src/App.tsx と同パターン、bundle 単位で副作用分離)
- **shared/MetaCard.tsx**: 内部の `<CardSilhouette>` を `<CardArt cardId={card.num} />` に置換 → DECK / CARDS / HOME / SETUP / RESULT で公式画像 (or src 既存 fallback) 表示
- **util/deckBridge.ts** (新): meta `DeckRecord.id` → engine `DeckId` ('CT-D08' / 'CT-D11') 変換
- **screens/SetupScreen.tsx**: `engineStub.flow.simulateMatch` → `performGameStart({ selfDeckId, oppDeckId })` + `useGameStateStore.setGameState(gs)` (async, mulligan 経由)
- **screens/RealMatchView.tsx** (新): src/App.tsx (133 行) の Playmat + 14 modals + 4 driver hooks を 5174 内に配置 — `engine.read.game.result` で終局検知し ResultScreen へ自動遷移 (1.8s 遅延で VictoryOverlay を見せる)
- **screens/ResultScreen.tsx**: `useHistoryStore.byId` ベース → `useGameStateStore.gameState` 直読 + engine 統計 (turn / evidence / refresh / scratchTrace) 集計 + historyStore に 1 件記録 (StrictMode dedup)
- **screens/MatchPlaceholder.tsx**: 削除 (RealMatchView に置換)
- **App.tsx**: `case 'match'` を `<RealMatchView onMatchEnd={() => nav('result')} />` に
- **tests/e2e/golden-path.spec.ts**: 模擬経路 → 実機経路 (HOME → SETUP → READY → MulliganModal「引き直しなし」→ Playmat) に書き換え
- **tests/e2e/engine-stub.spec.ts**: simulateMatch 系テスト削除、validateDeck + localStorage 分離テストのみ残置
- **.claude/specs/meta-ui/10-integration-with-src.md** (新) + INDEX 登録

## 不変条件 (絶対遵守)

- `src/` 配下 **1 行も変更しない** (import のみ) — `git status -- src/ vite.config.ts tsconfig.json tests/` で確認
- 既存 5173 ゲーム挙動完全維持、既存 vitest + playwright e2e 全件無修正で緑

## 検証

- tsc + build green (bundle 581 KB)
- meta-app e2e 15/15 緑 (smoke 10 / golden-path 3 / engine-stub 2)
- 5174 で HOME → 「推理開始」 → SETUP → READY → MulliganModal「引き直しなし」 → 本物 Playmat 表示 → 終局 → ResultScreen 自動遷移
- カード画像が公式画像 (or src/cardImage の SVG fallback) になる

## 実装で踏んだ罠 (10-integration-with-src.md に記録)

- `include` で `../src/**/*` 指定は rootDir 違反 → `paths` のみで paths 解決 + `rootDir: ".."` で解消
- node types: `tsv-loader-fs.ts` 経路 → `types: ["node"]` 追加
- `setGameState(null)` は型不可 → `useGameStateStore.setState({ gameState: null })` で直接
- MulliganModal は `useMulliganStore` 経由のため、RealMatchView を pre-mount してから performGameStart 開始する必要あり (SetupScreen で `nav('match')` を先に実行)

## 持ち越し (Phase 12+)

- 任意 DeckRecord → engine DeckSpec 変換 (現状 D08 / D11 専用)
- HistoryScreen の MatchRecord 集計を engine.log ベースに精緻化 (contacts / hirameki / misread)
- ReplayScreen の実盤面再生 (engine.event.applyUntil 利用)
