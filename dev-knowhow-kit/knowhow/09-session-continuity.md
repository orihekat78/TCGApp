# 09. セッション継続・引き継ぎ — AI 長期プロジェクトの記憶設計

Claude Code はセッション間で記憶を持たない。外部ファイルが唯一の継続記憶になる。

## memory.md スクラッチパッド + 80 行ローテーション

- `.claude/memory.md` = 現セッションの作業ログ。作業中は必ず追記（判断・実装・修正）
- 80 行を超えそうなら `.claude/sessions/YYYY-MM-DD.md` へ退避してリセット
  （同日 2 回目以降は `-2.md`, `-3.md`。並行ワークストリームはトピック接尾辞で分離）
- ローテート後の memory.md には各 session ファイルへの **1〜3 行要約つきリンク** を残す
  （要約に commit hash / テスト pass 数 / 未 commit 状態を含める）
- セッションログのテンプレ構成:
  `## 経緯（ユーザー指示の引用） / ## 方針判断 / ## やったこと / ## 検証（数値証跡） / ## 次の一手`

## NEXT-SESSION-PROMPT.md（次セッションへの明示的キックオフ）

「次セッションの最初のメッセージとしてそのままコピペしてください」という指示つきで、
コードフェンス内に完全なプロンプト文を置く。固定構成:

1. 読むべきファイルの順番（CLAUDE.md → CHANGELOG → structure.md → 最新セッションログ）
2. 🎯 最優先タスクとその理由・番号付き手順
3. 「現在地」（最新 commit hash / 未 push 数 / テスト pass 数 / 進捗カウンタ / 未解決バグ）
4. 作業順リスト（完了済みは ~~取り消し線~~ で残す — 進捗が一目で分かる）
5. 重要な参照ファイル一覧
6. **注意事項（過去の実事故から得た教訓）** — 例: 「git add -A 禁止（別ワークストリームの
   未コミット変更を巻き込んだ事故）」「stale なコメントを鵜呑みにしない（誤判定事故）」
7. 末尾「最初に何をすべきかを宣言してから着手してください」

テンプレートは templates/NEXT-SESSION-PROMPT-template.md。

## 3 ファイル・オリエンテーション規則

「新しいセッションの AI が **README → CHANGELOG → structure.md の 3 ファイルだけ** で
『何のプロジェクトか / 最新状況 / どこに何があるか』を把握できる状態を保つ」と CLAUDE.md に明記。

| 入口 | 内容 | 形式 |
|------|------|------|
| README.md | 紹介 + 起動 + リンク集のみ（薄く保つ） | 手書き |
| CHANGELOG.md | マイルストーン完了履歴 | 半自動（→ knowhow/05） |
| structure.md | 全ファイル説明 | 完全自動生成 |

## セッション終了の儀式（3 点セット + スナップショット）

毎セッション終了時に必ず:

1. memory.md 追記（またはローテート）
2. sessions/YYYY-MM-DD.md 作成
3. NEXT-SESSION-PROMPT.md 更新

全引き継ぎ記述に検証スナップショット定型行を埋める（→ knowhow/06）。
DEFER したものは理由つきで DEFERRED-INDEX.md に集約（→ knowhow/07）。

## 非開発者向けワンクリック起動（start.bat → setup-and-run.ps1）

オーナーが非開発者の場合、「clone/pull 後にダブルクリックで動く」が受け渡し条件になる。
同梱 scripts-portable/ の 2 ファイルが実例:

- start.bat: `chcp 65001`（日本語化け防止）→ PowerShell スクリプト起動 → エラー時 pause
- setup-and-run.ps1: Node 未導入なら winget で自動導入 + PATH 再読込 → バージョン下限警告 →
  node_modules と lockfile の **mtime 比較で npm ci を skip** → dev サーバを別ウィンドウ起動
  （タイトルに「閉じると停止します」表示）→ localhost へのポーリングで起動確認 → ブラウザ自動オープン
- 非開発者の 3 大ハマり（Node 未導入 / 依存未インストール / サーバ起動前に白画面）を全て自動処理

## Obsidian 統合（非開発者向け閲覧 UI）

- リポジトリ自体を Obsidian vault として開ける構成にする
- **HUB.md**: frontmatter つき中央ナビ。「まず最初に読む」3-4 リンク → 全ドキュメント群へ
  1 ホップのリンク集 + callout で現在フェーズ表示。リンクは `[名前](path.md)` 相対パス形式
  （wikilink にすると GitHub 上でリンクが死ぬ — 両対応の判断を明文化しておく）
- **PROJECT-MAP.canvas**: JSON Canvas でドキュメント群の関係を視覚化（群ごとに色分け group、
  進行中だけ赤色ハイライト）
- バグ台帳の集約 view（.base）も Obsidian で閲覧（→ knowhow/03）

## 移植手順

1. `.claude/memory.md` + `.claude/sessions/` + 命名規則 README を作成
2. CLAUDE.md にメモリ運用ルールとセッション終了チェックリストを明記
3. templates/NEXT-SESSION-PROMPT-template.md を設置して毎セッション更新
4. 非開発者が居るなら start.bat / setup-and-run.ps1 を自プロジェクト向けに調整
