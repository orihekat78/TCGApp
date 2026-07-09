# 名探偵コナンTCG Web アプリケーション

ローカルで「人間 vs CPU」「CPU vs CPU」が遊べる、
名探偵コナントレーディングカードゲーム（タカラトミー公式）の **個人利用限定** Web アプリ。

> ⚠️ 本プロジェクトは個人利用・私的使用を目的とした **非公式ファンプロジェクト** です。公式商品ではありません。
> © 青山剛昌／小学館 © TOMY
>
> - ソースコードの公開は学習・記録目的であり、アプリの公開ホスティング（Vercel 等）は行いません
> - カード画像・公式カードDBの生データはリポジトリに **同梱しません**（実行時に公式サイトから都度取得）
> - 権利者（株式会社タカラトミー／小学館）からの要請があれば **即座に公開を停止** します
> - 詳細な法務スタンス: [.claude/research/legal/04-recommendation.md](.claude/research/legal/04-recommendation.md)

## プロジェクト要件

- **対象ゲーム**: 名探偵コナントレーディングカードゲーム（タカラトミー公式・2024〜）
- **MVP 対象デッキ**:
  - CT-D08「青の古城探索事件」(Case-ThemeDeck 03)
  - CT-D11「千速と重悟の婚活パーティー」(Case-ThemeDeck 06)
- **技術スタック**: TypeScript 5 + React 19 + Vite + Immer + Vitest + Zustand
- **アーキテクチャ**: 純粋ロジック Engine (React 非依存) + Effect Descriptor DSL + Hook 機構
- **CPU AI**: Random / Heuristic / MCTS (MVP)
- **将来スコープ**: 全カード対応

## クイックスタート（Windows・ワンクリック）

クローン後、初めて遊ぶ場合はこれだけ：

1. リポジトリを取得：`git clone <repo>` → `git pull`
2. リポジトリ直下の **`start.bat` をダブルクリック**

`start.bat` が自動で以下を行います（[scripts/setup-and-run.ps1](scripts/setup-and-run.ps1)）：

- Node.js のチェック（未導入なら `winget` で LTS を自動インストール）
- 依存関係のインストール（`npm ci`。初回のみ、最新ならスキップ）
- 開発サーバー起動（別ウィンドウ）＋ 既定ブラウザで **`http://localhost:5173`** を自動オープン

→ ブラウザで「対戦開始」を押せばプレイ開始。**終了はサーバーウィンドウを閉じる**だけ。

> winget が無い環境では、案内に従い [nodejs.org](https://nodejs.org/ja) から Node LTS を入れて再実行してください。

## 起動（手動 / 開発者向け）

```sh
npm install      # または npm ci（package-lock.json から確実に再現）
npm run dev      # http://localhost:5173/ — 人間 vs CPU を end-to-end でプレイ
npm test         # Vitest (unit + integration)
npm run test:e2e # Playwright (headed default)
npm run docs     # 自動生成ドキュメント全部更新
```

## ドキュメント構成

### 入り口

- **[HUB.md](HUB.md)** — 🔍 全ドキュメントへのナビゲーションハブ (Obsidian 推奨)
- **[CHANGELOG.md](CHANGELOG.md)** — 📜 Phase / Round 単位の完了履歴 ("何ができたか")
- **[.claude/auto/structure.md](.claude/auto/structure.md)** — 🗂 リポジトリ構造 + 全ファイル説明 (自動生成)

### 規約・運用

- [.claude/CLAUDE.md](.claude/CLAUDE.md) — プロジェクト規約 (骨格凍結原則 / セルフレビュー手順 / 効率より精度)
- [.claude/memory.md](.claude/memory.md) — 現セッション作業ログ
- [.claude/sessions/](.claude/sessions/) — 過去セッションのアーカイブ (日次詳細)
- [.claude/auto/README.md](.claude/auto/README.md) — 🤖 自動生成ドキュメント運用ガイド

### 仕様・調査

- [.claude/rules/INDEX.md](.claude/rules/INDEX.md) — 公式ルール集 (Ver 2.4 + Q&A 裁定 + フロアルール)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md) — Engine API / UI / カード分析 全 spec
- [.claude/research/plans/2026-05-11-mvp-implementation/](.claude/research/plans/2026-05-11-mvp-implementation/) — MVP 実装プラン (10 Phase)
- [.claude/bugs/index.base](.claude/bugs/index.base) — リスク・バグ管理表 (Obsidian Base)

## 法務スタンス（重要）

- **完全ローカル限定運用**（個人 PC 内のみ）
- カード画像はリポジトリ非同梱・実行時公式サイトから取得・キャッシュ
- 公開ホスティング・GitHub 公開（カード画像同梱）禁止
- 詳細: [.claude/research/legal/04-recommendation.md](.claude/research/legal/04-recommendation.md)

## 開発ガバナンス

- 全 Markdown ファイル 100 行以内 (自動生成物は例外)
- 作業時は [.claude/memory.md](.claude/memory.md) に必ず追記
- 骨格凍結原則: カード効果のための engine 修正禁止 → `cards/_shared/` に共通クラスで吸収
- ユーザーレビュー前に Claude 自身が **セルフレビュー + 水平展開調査** を実施
- 詳細: [.claude/CLAUDE.md](.claude/CLAUDE.md)

## この README の運用

README は「プロジェクト紹介・起動方法・主要リンク」だけを保持する。役割が分離されている:

- **何ができたか (履歴)** → [CHANGELOG.md](CHANGELOG.md) に手書きで追記 (Phase / Round 完了時)
- **構造・ファイル説明** → `npm run docs:structure` で [.claude/auto/structure.md](.claude/auto/structure.md) を再生成
- **日次作業ログ** → [.claude/memory.md](.claude/memory.md) + [.claude/sessions/](.claude/sessions/)
- **規約・手順** → [.claude/CLAUDE.md](.claude/CLAUDE.md)
