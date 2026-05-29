# 00 — メタ UI 統合設計 概要

## 目的

`design-mockups_v2/` のメタゲーム UI モック (HOME / SETUP / RESULT / DECK 編集 / CARDS / HISTORY / REPLAY / TUTORIAL / SETTINGS の 9 画面 + 6 効果演出) を、conan リポジトリ内の **独立した TypeScript/React アプリ** として正式実装する。

## スコープ

### IN
- 新規ディレクトリ `meta-app/` の作成と全コンポーネント TS 実装
- 専用 Vite 設定 + npm script (`dev:meta` / `build:meta` / `preview:meta`)
- `meta-app/` 専用 zustand store (3 種) + persist (`conan.meta.v1.*` namespace)
- engineStub TS 版 (localStorage-backed フェイク、本物 engine 非依存)
- 9 画面の TS 実装 + 280ms フェード遷移 + キーボードショートカット
- `meta-app/tests/` 配下 Playwright e2e (全画面 golden path)
- `.claude/specs/meta-ui/` 配下 設計書 10 ファイル + サブ INDEX

### OUT (Phase 10 対象外)
- `src/` (既存ゲーム) への変更 (**禁止**)
- 既存テスト (`tests/`) への変更
- 既存ゲームと meta-app 間のデータ連携 (localStorage 共有 / URL クエリ / postMessage 全て不採用)
- 本物 engine API への接続 (将来 Phase 11 で検討可)
- 演出 (`05-effect-animations.html`) の本実装 (静的モック流用、本実装は Phase 11+)

## 独立アプリ方針 (ユーザー確定済)

1. **既存 5173 ゲーム完全不変**: `src/` 配下 1 行も触らない
2. **メタ UI 別ポート 5174 並走**: 専用 Vite サーバ
3. **データ連携なし**: 5173 と 5174 は完全独立した 2 アプリ
4. メタの「対戦」「履歴」は engineStub 内で完結 (実機ではない、デザインプロトタイプ)

## 関係図

```
conan/                              ← リポジトリルート
│
├── src/                            ← 既存ゲーム本体 (port 5173)
│   ├── App.tsx                       完全不変
│   ├── ui/                           完全不変
│   └── engine/                       完全不変
├── vite.config.ts                  ← 既存 (5173) 完全不変
│
├── design-mockups/                 ← v1 盤面モック (参照のみ、不変)
│   └── 01-board-mockup.html         既存 Playmat の視覚参照
│
├── design-mockups_v2/              ← v2 メタモック原本 (参照のみ、不変)
│   ├── 06-home.jsx / 08-setup.jsx ... 実装ソース
│   ├── G-integration-plan.md         当初統合計画
│   └── E13/E14/E15/C/C9/F-*.md       設計監査資料
│
└── meta-app/                       ← Phase 10 で新設 (port 5174)
    ├── src/                          メタ UI 本体 TS
    ├── tests/                        Playwright e2e
    ├── vite.config.meta.ts           専用設定
    ├── tsconfig.json
    └── index.html
```

## 利点と欠点 (ユーザー説明済)

### 利点
- 既存対戦体験への影響ゼロ (回帰リスクなし)
- 並列開発可能 (5173 と 5174 を同時起動)
- 実装リスク最小 (依存範囲が `meta-app/` 内に閉じる)
- 設計書 / 実装ともに既存 spec 群と分離、レビュー容易

### 欠点
- メタの「対戦開始」は engineStub による模擬対戦 (実機ではない)
- 履歴は 5174 内に閉じる (5173 の実対戦結果は反映されない)
- カードプール定義が `src/` と `meta-app/` で重複 (将来 Phase 11 で統一検討)

## 関連
- 上位: [INDEX.md](INDEX.md)
- 次: [01-project-setup.md](01-project-setup.md)
- ピボット元: `design-mockups_v2/G-integration-plan.md` (当初は src/ 内統合を提案、独立アプリへ転換)
