# CLAUDE.md — {{プロジェクト名}} プロジェクト規約（テンプレート）

> conan プロジェクトで実証済みの規約構成。{{...}} を埋めて `.claude/CLAUDE.md` に置く。
> **新しいセッションを開始したら最初に必ずこのファイルを読むこと。**

## プロジェクト概要

- **目的**: {{何を作るか・誰が使うか}}
- **技術スタック**: {{例: TypeScript + React + Node.js}}
- **MVP スコープ**: {{最初に動かす最小範囲}}
- **将来スコープ**: {{最終目標}}

## 一次情報参照義務（最重要・実証済みの効果大）

ドメイン知識（{{公式ルール / 法令 / API 仕様 / 業務ルール}}）に関する判断を行うときは **必ず**:

- `.claude/rules/INDEX.md` から該当トピックを開く
- **推測で補完しない**。記述がない事項は「不明」として扱い、ユーザー確認 or 一次情報源を再取得
- 解釈に疑義がある場合は `.claude/rules/sources.md` の出典リンクを再確認

## 最優先方針: 効率より精度

- "おそらく" "多分" で進めない。コード / 一次情報 / 実行ログを直接参照して根拠を確定
- 時短のための短絡（サンプル数縮小・水平展開省略・推測での判定）は禁止
- **速度 < 精度** を全フェーズで優先

## セルフレビュー（ユーザーレビュー依頼の前に必須）

- [ ] 実装が要件通りか / `.claude/rules/` と矛盾がないか
- [ ] エッジケース（{{0件・上限・不可逆操作・状態相互作用・マイナス値 など領域固有 5 分類}}）を考慮したか
- [ ] テスト・型チェック・lint が通るか
- [ ] **実機通し検証**（画面があるなら Playwright で操作→状態反映まで。「画面表示確認 ≠ 機能確認」）
- [ ] **表示・処理が仕様文言と 1 対 1 で一致** するか（条件外の decoy を置いて確認）
- [ ] バグ管理表更新（`.claude/bugs/BUG-XXX.md`）

## 水平展開調査（必須）

- 修正・追加した箇所と **同じ構造を持つ他の箇所** を必ず全件調査する
- 調査結果は `.claude/memory.md`（または `.claude/sessions/<日付>.md`）に記録

## 骨格凍結原則（コア凍結 + 周辺拡張）

- **コア（{{エンジン/基盤層}}）は原則編集禁止**。例外: 一次情報の変更時 / コア自体のバグ / 動作不変の最適化
- 個別機能対応のためのコア修正は禁止。パターン再出現は `_shared/` に共通クラス追加で対応
- 共通クラスは破壊的変更禁止。新パターンは新クラスで
- 新規追加 1 件あたり touched files が {{3}} を超えたら設計見直し

## 自動生成ドキュメント運用（`.claude/auto/`）

- `scripts/gen-docs/` で自動生成。**手で編集禁止**（次回生成で上書き）
- `npm run docs` で全生成 / `npm run docs:check` を pre-commit で差分検知
- 差分があるとコミット失敗 → `npm run docs` → 再コミット

## リスク・バグ管理

- 1 バグ = 1 ファイル `.claude/bugs/BUG-XXX.md`（frontmatter: id/title/severity/category/status/round/date_found/reporter、修正済なら +date_fixed/commit）
- 集約 view は `.claude/bugs/index.base`（Obsidian Base）
- 修正完了時に status 更新 + commit hash 記録。水平展開で見つけた同種バグも同 commit で
- 月次 audit: `npm run bug:trend` + 各 lint → `AUDIT-YYYY-MM.md` 作成 → 教訓は LESSONS-LEARNED.md へ（**各教訓に enforcement スクリプト名を明示**）

## メモリ運用

- 作業時は必ず `.claude/memory.md` に追記（判断・実装・修正の記録）
- 80 行を超えそうなら `.claude/sessions/YYYY-MM-DD.md` へ移動してリセット（同日 2 回目以降は `-2`, `-3`）

## ファイルサイズ制約

**全 Markdown ファイルは 100 行以内**。超過するなら分割（ルール→トピック別 / ログ→日付別 / 設計→機能別）。

## セッション開始時の確認順

1. `.claude/CLAUDE.md`（本ファイル）
2. `README.md`（薄く保つ: 紹介 + 起動 + リンク集のみ）
3. `CHANGELOG.md`（何ができたか。最新状況はまずここ）
4. `.claude/auto/structure.md`（全ファイル説明、自動生成）
5. `.claude/memory.md`（進行中の作業ログ）

## ドキュメント役割分離

| 何 | どこ | 形式 |
|----|------|------|
| 履歴（何ができたか） | `CHANGELOG.md` ← `.claude/changelog-entries/` | 半自動（エントリ手書き→集約生成） |
| 構造・ファイル説明 | `.claude/auto/structure.md` | 自動生成・手書き禁止 |
| 日次作業ログ | `.claude/memory.md` + `.claude/sessions/` | 80 行ローテート |
| 紹介・起動 | `README.md` | 手書き・薄く |
| 規約・手順 | `.claude/CLAUDE.md` | 手書き |

新セッションの Claude が README → CHANGELOG → structure.md の 3 ファイルだけで全体像を把握できる状態を保つ。
