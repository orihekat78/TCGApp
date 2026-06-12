# 05. ドキュメント自動生成 — gen-docs + pre-commit 差分ゲート

「docs がコードから乖離する」を人の注意力でなく機械的 diff で防ぐ。
scripts-portable/gen-docs/ に汎用部分（dispatcher / header / markdown / changelog / structure）を同梱。

## アーキテクチャ: 単一エントリポイント + check モード

- `scripts/gen-docs/index.ts` が全 generator の唯一の CLI。各 generator は
  `run({checkOnly}): {changedFiles, totalFiles}` の統一インターフェースで dispatch テーブルに登録
- `check` は全 generator を checkOnly で実行し、期待コンテンツをメモリ上でレンダリング →
  ディスクと byte 一致比較。書き込みなし、drift があれば exit 1 +「npm run docs で再生成せよ」
- **check と write が同じレンダリング関数を共有** → 「check は通るが生成結果が違う」事故が構造的に起きない
- write モードでも diff が無ければ書き込まない（mtime 汚染防止）

## 全生成ファイル共通ヘッダ（lib/header.ts）

- 「⚠️ 自動生成。手で編集しない / 再生成: `npm run docs:X` / Source hash: `<sha256 12 桁>`」を全生成 md の先頭に埋め込み
- source hash の対象 = 入力ファイル群 + **generator 自身のパス**（スクリプト変更でも再生成を強制）
- **鉄則: 出力ファイル自身を hash 対象に含めない**（生成→hash 変化→再生成の無限サイクルになる。実際に踏んだ罠）

## docs:check を pre-commit ゲートに

- コード変更 → docs 未再生成でコミット → docs:check が exit 1 → `npm run docs` → 再コミット、の強制ループ
- 生成 docs は git 管理し **コードと同一 commit で更新**（CI 生成方式と違い、clone 直後から
  最新 docs が読める = AI が structure.md を読むだけで現状把握できる前提を支える）

## 編集禁止の 3 層宣言

1. ファイル自体のヘッダ（再生成コマンド自己記述）
2. 出力ディレクトリ直下の手書き README.md 1 枚（generator 一覧表 + なぜ自動生成か）
3. CLAUDE.md の運用節

それでも編集されたら pre-commit の docs:check が drift として検出（宣言 + 機械強制のセットで初めて機能する）。

## changelog-entries → CHANGELOG.md 集約（半自動 changelog）

- CHANGELOG.md は生成物。ソースは `.claude/changelog-entries/YYYY-MM-DD-NN-slug.md`（手書き、1 エントリ = 1 マイルストーン完了）
- 特殊ファイル: `_unreleased.md`（残課題、先頭挿入）/ `_footer.md`（現在メトリクス、末尾）
- gen-changelog.ts がファイル名ソート降順に連結
- **利点**: 追記が「新ファイル作成」になるため複数セッション/エージェントの編集 conflict が消える。
  エントリには commit hash を必ず書く（後から git log と突合できる）

## structure.md: fs walk + 説明辞書 + コメント抽出のハイブリッド

- リポジトリ全体を walk して全ファイルのツリー + 説明を生成。説明は 3 段フォールバック:
  ①structure-dictionary.json の明示エントリ（主要 10〜20 件だけ手書き）
  ②.md は先頭見出し ③.ts は先頭コメント 1 行目
- ツリーは常に正確（fs が真実）、説明は重要箇所だけ厚く
- 副次効果: 「.ts の先頭にコメントを書けば structure.md に載る」というコメント記述インセンティブ

## 応用 generator（必要になったら）

- **ts-morph API リファレンス**: 公開エントリポイントの export 名 + シグネチャ + 先頭コメント 1 行
  だけ抽出（TypeDoc 的全網羅でなく AI の一覧把握用に最適化）。`npm i -D ts-morph`
- **mapping（逆引き索引）**: 実装ファイル冒頭の `// rules:` / `// spec:` コメントを regex 抽出し
  「ルール 1 件 → 参照ソース全列挙」の by-rule docs を生成（要件↔実装トレーサビリティ）
- **検証付き手書き図**: Mermaid 図はスクリプト内に手書き定数で持ち、図中の状態名だけ
  ソースの型 union から抽出して assert 照合（絵は手書き・語彙はコード検証。enum が変われば docs:check が落ちる）

## 移植手順

1. scripts-portable/gen-docs/ をコピー（index.ts / lib/ / gen-changelog.ts / gen-structure.ts）
2. gen-structure.ts の EXCLUDE_* を調整、structure-dictionary.json を最小（10 件程度）で開始
3. npm scripts: `docs` / `docs:check` / `docs:changelog` / `docs:structure` を登録
4. docs:check を pre-commit に連結（→ knowhow/04）
5. 最初は generator 2 本（structure + changelog）から。API/mapping は必要になってから
