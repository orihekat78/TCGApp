# メタゲーム UI 統合設計書 (Phase 10) — INDEX

`design-mockups_v2/` で完成したメタゲーム UI モック (HOME / SETUP / RESULT / DECK / CARDS / HISTORY / REPLAY / TUTORIAL / SETTINGS の 9 画面) を、conan リポジトリ内の **独立した TypeScript/React アプリ (`meta-app/`)** として正式実装する Phase 10 の設計書セット。

## 重要前提

- 既存 `localhost:5173` (`src/` 配下) は **完全不変** — コード 1 行も触らない
- メタ UI は **別ポート 5174** で並走、専用 Vite 設定 (`meta-app/vite.config.meta.ts`)
- 既存ゲームとの **データ連携なし** — localStorage 共有もせず、両アプリは独立
- メタ UI は engineStub (localStorage-backed フェイク) で完結、本物 engine 非依存

## 設計書一覧 (各 100 行以内)

| # | ファイル | 内容 |
|---|---|---|
| 1 | [00-overview.md](00-overview.md) | 目的 / スコープ / 独立アプリ方針 / 関係図 |
| 2 | [01-project-setup.md](01-project-setup.md) | `meta-app/` 構成 / Vite 設定 / npm scripts / tsconfig |
| 3 | [02-design-system.md](02-design-system.md) | tokens.ts / 共通プリミティブ TS 化計画 |
| 4 | [03-routing.md](03-routing.md) | useHashRoute / MetaShell / 遷移エッジ / ショートカット |
| 5 | [04-state-stores.md](04-state-stores.md) | metaStore / decksStore / historyStore + persist |
| 6 | [05-engine-stub.md](05-engine-stub.md) | engineStub TS 化計画 |
| 7 | [06-screens-play-flow.md](06-screens-play-flow.md) | HOME / SETUP / RESULT |
| 8 | [07-screens-library.md](07-screens-library.md) | DECK / CARDS |
| 9 | [08-screens-reference.md](08-screens-reference.md) | HISTORY / REPLAY / TUTORIAL / SETTINGS |
| 10 | [09-phasing-and-verification.md](09-phasing-and-verification.md) | Phase 10-A〜10-J 工程 + 検証 + F-audit 残課題 |
| 11 | [10-integration-with-src.md](10-integration-with-src.md) | **Phase 11**: 5174 を src/ 実機ゲーム + 新メタ UI 統合版へ進化 (Playmat / mulligan / CardArt 等を import で再利用) |
| 12 | [11-cards-rebuild.md](11-cards-rebuild.md) | **Phase 12**: CardsScreen を元モック忠実に再構築 (COVERAGE / 47 枚 JSON / 検索 / ソート / ★ お気に入り / USAGE) |
| 13 | [12-screens-rebuild.md](12-screens-rebuild.md) | **Phase 13**: 残り 7 画面 (HOME / SETUP / RESULT / DECK / HISTORY / TUTORIAL / SETTINGS / REPLAY) を元モック忠実に rebuild |
| 14 | [13-implementations.md](13-implementations.md) | **Phase 14**: MetaCard chrome 削除 + 未実装機能完成 (カスタムデッキ実機対戦 / フィルター拡張 / log 集計 / 練習試合 / cardBack) |
| 15 | [14-tutorial-complete.md](14-tutorial-complete.md) | **Phase 15**: チュートリアル完成 (8 章 + 進捗 persist + 練習試合連携、rules/01〜26 網羅) |
| 16 | [15-tutorial-lesson-viewer.md](15-tutorial-lesson-viewer.md) | **Phase 16**: ステップクリック→フルスクリーン lesson viewer (33 ステップ図解 / ページめくり / Workflow ルール監査 15 finding 反映、他 TCG 参考) |
| 17 | [16-tutorial-real-board.md](16-tutorial-real-board.md) | **Phase 17**: 実対戦フォーマット流用 (実 Playmat 盤面スナップショット / 事件カード横向き / region・ゾーン該当箇所強調) + ワイド2ペイン + 章ごとガイド付き実戦 (src TutorialOverlay 流用) |

## 関連リソース

### モック資産 (両方残置)

- `design-mockups/01-board-mockup.html` — v1 盤面モック (既存 5173 Playmat の視覚参照)
- `design-mockups_v2/` — v2 メタゲーム全 9 画面モック + 6 効果演出 (本 spec の実装ソース)
- `design-mockups_v2/G-integration-plan.md` — 当初の統合計画 (本 spec の基盤、ただし方針は独立アプリへピボット)
- `design-mockups_v2/E13-design-system.md` / `E14-screen-flow-spec.md` / `E15-component-guide.md` — モック側設計書
- `design-mockups_v2/C-engine-ui-map.md` / `C9-modal-review.md` / `F-rule-audit.md` — モック側監査

### ルール参照

- `.claude/rules/INDEX.md` — 公式ルール抜粋 (`01-victory-conditions.md` ⚠ アシスト勝利不可など)

### 既存システム (不変)

- `src/App.tsx` / `src/ui/state/store.ts` / `src/services/deckBuilder.ts` / `src/ui/styles/tokens.css` — 既存ゲーム側、変更なし

## ナビゲーション
- 上位 INDEX: [.claude/specs/INDEX.md](../INDEX.md)
- 進捗ログ: `.claude/memory.md` + `.claude/sessions/`
