# dev-knowhow-kit — conan プロジェクト開発ノウハウ持ち出しキット

conan（名探偵コナン TCG Web アプリ）プロジェクトで実証された開発運用ノウハウ・
MCP サーバ構成・再利用可能スクリプトを、**他フォルダのプロジェクトへそのまま
コピーして使える形** にまとめたもの。

## 使い方

1. このフォルダごと新プロジェクトの直下にコピーする
2. [setup-checklist.md](setup-checklist.md) を上から実行する（Phase 1 だけで最小構成が立つ）
3. 新プロジェクトの Claude Code に「dev-knowhow-kit/setup-checklist.md に従って
   セットアップして」と指示すれば自動展開できる

## フォルダ構成

| パス | 内容 |
|------|------|
| [setup-checklist.md](setup-checklist.md) | 新プロジェクト立ち上げ手順（Phase 1〜6） |
| [mcp/](mcp/) | MCP サーバ構成（.mcp.json テンプレ + 再登録コマンド + プラグイン一覧） |
| [templates/](templates/) | コピーして使うテンプレート（CLAUDE.md / バグ票 / 教訓集 / 引き継ぎプロンプト / Obsidian Base） |
| [scripts-portable/](scripts-portable/) | そのまま流用できる実スクリプト（lint / gen-docs / ワンクリック起動） |
| [knowhow/](knowhow/) | ノウハウ解説 9 編（下表） |

## ノウハウ 9 編の概要

| # | ファイル | 一言でいうと |
|---|----------|--------------|
| 01 | [process-discipline](knowhow/01-process-discipline.md) | 精度>速度・セルフレビュー・水平展開・エッジケース 5 分類 |
| 02 | [knowledge-base](knowhow/02-knowledge-base.md) | 外部一次資料を ≤100 行のトピック別抜粋に変換し参照を義務化 |
| 03 | [bug-tracking](knowhow/03-bug-tracking.md) | 1 バグ 1 ファイル + Obsidian Base 集約 + 教訓→enforcement 連鎖 |
| 04 | [enforcement-scripts](knowhow/04-enforcement-scripts.md) | 教訓を lint スクリプト化し pre-commit で機械強制 |
| 05 | [doc-automation](knowhow/05-doc-automation.md) | ドキュメント自動生成 + docs:check 差分ゲート + 役割分離 |
| 06 | [verification](knowhow/06-verification.md) | 実機検証・decoy 突合・決定論 smoke・E2E ハーネス設計 |
| 07 | [architecture-freeze](knowhow/07-architecture-freeze.md) | 骨格凍結 + capability map / ゲート表 / DEFER 台帳 |
| 08 | [agent-pipeline](knowhow/08-agent-pipeline.md) | 大量バックログの certify→verify→codegen ファネル |
| 09 | [session-continuity](knowhow/09-session-continuity.md) | memory 80 行ローテ・NEXT-SESSION-PROMPT・3 ファイル把握 |

各編は「何か / なぜ効くか（実バグ・実事故の根拠つき）/ 新プロジェクトへの移植手順 /
conan 固有で差し替えるべき部分」の構成。

## このキットの前提

- 対象: Claude Code（または同等の AI エージェント）と人間が共同で長期開発するプロジェクト
- 技術スタックは TypeScript/Node を想定したスクリプトが多いが、**運用パターン自体は言語非依存**
- conan 固有の語彙（カード / engine / Round 等）は knowhow 各編の「移植のしかた」で
  パラメータ化の指針を示してある

## セキュリティ注意

- mcp/.mcp.json の GitHub トークンは **プレースホルダ**。実トークンをこのキットや
  リポジトリに平文で書かないこと（環境変数 or 登録コマンド時に指定）
- キット作成時、ユーザーレベル設定（~/.claude.json）に平文 PAT が存在していた。
  共有・流出リスクがあるため **GitHub で revoke → 再発行を推奨**

---
作成: 2026-06-11（conan リポジトリの実運用 6 領域 + 補完調査から抽出、ソース: BUG-001〜127 /
LESSONS-LEARNED / scripts/ 実装 / CLAUDE.md 規約 / セッションログ）
