# CLAUDE.md — 名探偵コナンTCG Webアプリ プロジェクト規約

このファイルは Claude Code がこのプロジェクトで作業する際の規約を定める。
**新しいセッションを開始したら最初に必ずこのファイルを読むこと。**

## プロジェクト概要

- **対象ゲーム**: 名探偵コナントレーディングカードゲーム（タカラトミー公式・2024〜）
- **公式ルール準拠バージョン**: オフィシャルルールマニュアル **Ver 2.4**
- **目的**: ローカルサーバで「人間 vs CPU」「CPU vs CPU」が遊べる Web アプリ
- **技術スタック**: TypeScript + React + Node.js
- **MVP対象デッキ**: CT-D08「青の古城探索事件」(Case-ThemeDeck 03) / CT-D11「千速と重悟の婚活パーティー」(Case-ThemeDeck 06)
- **将来スコープ**: 全カード・全ルール対応

## 法務スタンス（フェーズA調査結果準拠）

- **完全ローカル限定運用**（個人PC内のみ）
- カード画像はリポジトリ非同梱・実行時都度フェッチ
- 公開Webホスティング・カード画像同梱は **禁止**
- 詳細: `.claude/research/legal/04-recommendation.md`

## ルール参照義務

ゲームルール・カード処理に関する判断を行うときは **必ず** 以下を参照：

- `.claude/rules/INDEX.md` から該当トピックを開く
- 推測でルールを補完しない
- `.claude/rules/` に記述がない事項は不明として扱い、ユーザー確認 or 公式PDF再フェッチを行う
- ルール解釈に疑義がある場合は `.claude/rules/sources.md` の公式リンクを再確認

## 開発時の厳格レビュー手順

### 最優先方針: リスク連動の精度 (2026-07-02 user_request で改定)

2026-05-21 の「速度 < 精度 一律」は **撤回**。精度の床は機械ゲート
(tsc / vitest baseline / smoke:1000 / 8 lint / CI + TDD probe test) が全変更で担保し、
トークンを食うエージェント検証は変更リスクに連動させる (詳細・tier 表:
[speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md))。

- **T1 (pure-additive evaluator / 出荷済 exemplar の clone)**: 機械ゲート + probe test のみ。敵対 review 0-1 lens。
- **T2 (新 verb / emit 多点配線 / WRITE 側)**: 2 lens (semantic + edge-test)。
- **T3 (hot-path / resolver / flow core / GameState 形状 / MR)**: 従来フル (4 lens + Playwright)。

変わらないもの: 推測でのルール補完禁止 / grounding (印字テキスト全列 ⇔ DSL 突合) /
骨格凍結原則。post-ship バグは BUG-XXX 運用で回収する (bug budget 容認)。

ユーザーレビュー(RV)を依頼する **前** に、Claude自身が必ず以下を実施：

### 1. セルフレビュー（必須）

- [ ] 実装が要件通りか
- [ ] `.claude/rules/` と矛盾がないか
- [ ] エッジケース（手札0枚、デッキ0枚、リフレッシュ、同時アクション、変装中の効果引継ぎ等）を考慮しているか
- [ ] テストが通るか
- [ ] 型エラー・lintエラーがないか
- [ ] **Playwright 1 試合通し検証** (T3 変更 or 新 UI 部品「型」が生えた round のみ。2026-07-02 tier 化)
  - 静的 screenshot だけでなく、click → effect resolution → state 反映を実機で確認
  - 人間 vs CPU を mulligan → 勝敗決定 (or max 30 turn) まで通して操作
  - 各 step で console error 0 確認
  - **「画面表示確認 ≠ 機能確認」**、両方必要
- [ ] **Playwright で「画面処理 = カードテキスト文言」検証** (family exemplar のみ。clone は決定表 diff で代替、2026-07-02 tier 化)
  - ゲーム画面上の処理 (候補列挙 / 選択 / 結果) が、カードの **公式テキストの文言と語義通り**に
    一致するかを実機で確認する。表示が出るだけでは不十分。条件外の decoy を盤面に置き、
    対象範囲・filter 条件 (LP/レベル/色/特徴/種別/状態)・枚数・選択者・持続・複数択 modal が
    テキストの語と 1 対 1 で一致することを確認 (詳細: [card-addition-checklist.md](specs/card-addition-checklist.md) §7)
  - 型/DSL に条件が書けていても engine が評価する保証はない (BUG-117/118)。実機で必ず踏むこと
- [ ] **リスク・バグ管理表更新** ([.claude/bugs/](bugs/) 配下に該当 BUG-XXX.md を作成 or 更新、Round 4a Phase 6.4 導入)
- [ ] **カード追加時**は [card-addition-checklist.md](specs/card-addition-checklist.md) を必ず通す (kind 分岐網羅 / hook listener 配線 / resolver dispatch 確認)

### 2. 水平展開調査（必須）

- 修正・追加した箇所と **同じ構造を持つ他の箇所** を必ず調査する
- 例: あるカード効果のバグ修正なら、類似処理の他カードを全件確認
- 例: あるフェイズ処理修正なら、他フェイズで同じ問題がないか確認
- 調査結果は `.claude/memory.md` (または `.claude/sessions/<日付>.md`) に必ず記録

### 3. ユーザーレビュー依頼

- 上記2点が完了して初めてユーザーへ提出
- 提出時は「セルフレビュー実施済」「水平展開調査完了」と明記

## 設計レビュー必須チェックリスト

実装フェーズに移る前、各設計ドキュメント (`.claude/specs/` 配下) は以下を必ず通すこと。
このチェックを通っていない設計を spec として確定してはならない。

### 1. ルール網羅性チェック（最重要）

- [ ] `rules/01〜26` を1件ずつ開き、その規則が設計のどこに反映されているか書き出す
- [ ] 該当ルールが「触れない」場合は明示的に「out of scope: 理由」と書く
- [ ] 推測でルールを補完しない（CLAUDE.md「ルール参照義務」に従う）

### 2. エッジケース列挙

ハッピーパスのみで設計を確定してはならない。最低5件のエッジケースを含めること:

- 0枚 (手札0/デッキ0/現場0/証拠0)
- 不可逆操作 (アシスト/事件解決/解決編→事件編不可)
- 状態相互作用 (スタン特殊挙動・名乗り例外・突撃迅速)
- 数値マイナス (AP/LP/レベル下限なし・LP≤0推理)
- 複合・連鎖 (変装中の効果引継ぎ・コンタクト中の効果切れ)

### 3. 水平展開

修正・追加した箇所と同じ構造を持つ他箇所を必ず調査する。
例: 推理の確認モーダルを設計したら、アクション・アシスト・事件解決の確認モーダルも整合させる。

### 4. 状態完備性

`GameState` 全フィールドが「いつ更新され、UIのどこに反映されるか」明示すること。

- 各 state field → UI component の対応表を持つ
- UI から逆引きで「この要素はどの state 由来か」追跡可能

## 修正範囲を最小化する運用（骨格凍結原則）

カード効果実装に伴う修正範囲を時間とともに **収束** させるため、以下を必須運用とする。

### 骨格凍結原則

- **骨格 (Engine) は原則編集禁止**
- 例外として骨格を編集してよいケース:
  - 公式ルール (rules/) の変更時
  - 骨格自体のバグ修正
  - パフォーマンス改善（動作不変な内部最適化のみ）
- **カード効果対応のための骨格修正は禁止**

### 共通クラス運用

- パターンが3枚以上で出現しても **骨格にはプロモートしない**
- 代わりに `cards/_shared/` 配下に **共通クラスを追加** する
- 共通クラスは **破壊的変更禁止**。新パターンは「新クラス追加」で対応
- 共通クラスは必ず骨格APIを経由してstate操作する（骨格内部アクセス禁止）

### 必須運用ルール

- [ ] カード間の直接参照禁止（必ず共通クラス経由）
- [ ] カードファイル冒頭にルール参照コメント必須（例: `// rules: 11-reasoning.md §LP≤0`）
- [ ] 新カード追加時の touched files が 3 を超えたら設計見直し
- [ ] 月次レポート: 骨格PR数 / 共通クラス変更数 / 新カード touched files 平均

### 推奨運用

- [ ] Effect Descriptor (DSL) を最大限活用、カスタム TypeScript は最終手段
- [ ] Effect Descriptor は JSON シリアライズ可能を維持
- [ ] 新カード追加時の自動プレイテスト 1000戦
- [ ] Immer 経由の state mutation のみ

### 数値ターゲット（収束の見える化）

| 指標 | 初期 | 6ヶ月後目標 | 1年後目標 |
|------|-----|------------|----------|
| 骨格コード行数 | ~2000 | 同じ | 同じ |
| 骨格 PR / 月 | - | 0 | 0 |
| 新カード追加時 touched files | 5 | 3 | 2 |
| 新カード追加時の修正行数 | 200 | 100 | 80 |
| バグ修正 PR / 月 | 高 | 中 | 低 |

## トークン運用ルール (2026-06-12 ユーザー指示 ①〜④)

### モデル段階化 (workflow / subagent)

- **基本作業は opus 主体**: 通常作業 (カード実装/調査/ドキュメント等) のオーケストレーションと
  実作業は `model:'opus'` を明示。
- **難判断も当面 opus を最初から使う (fable は使わない)** (2026-06-14 改定): `claude-fable-5` が
  workflow agent / subagent で利用不可になっている (2026-06-14 cluster3 で verify lens が
  「model not available」で全失敗)。fable を先に試すのは呼び出し/レイテンシの無駄 + ワークフロー途中
  失敗のリスクのため、難判断 (ルール裁定の解釈、カードテキスト⇔DSL の意味等価判定、敵対的反証) も
  **開始時点から `model:'opus'`** を指定する。fable で行っていた「やり方・思考」(grounding→敵対的反証、
  意味等価の 1対1 突合) はモデル非依存で opus でそのまま保たれる (cluster3 で opus 突合 15/15 equivalent を実証)。
  最上位ティアの単発判断力の差は **冗長な opus パス** (multi-vote / perspective-diverse lens) で補償する。
  fable が再び安定利用可能になったら難判断を fable に戻す
- **リファクタリングレベルの作業は Fable 主体**: refactor-plan のフェーズ群・骨格 (engine) に
  触れる変更は Fable がオーケストレーション・実作業を主導する
  (セッション本体のモデルは /model で切替: リファクタ系セッション=fable / 通常セッション=opus 推奨)
- **sonnet は慎重に選定した機械作業のみ**: grep/集合一致検証、diff の機械突合、whitelist 抽出、
  lint/テスト実走系 lens。迷ったら opus
- 適用対象: Workflow `agent()` の `opts.model` / Agent tool / `scripts/wf-*.mjs` 系パイプライン

### 標準活用リソース (2026-06-12 採用)

- **playwright MCP**: セルフレビュー必須項目の「1試合通し実機検証」「画面処理=カードテキスト文言検証」
  は e2e spec 新作よりも playwright MCP の直接操作を第一選択にする
- **obsidian MCP / obsidian-bases skill**: bugs/index.base の view 管理・月次 AUDIT 集計に使用
- **schedule skill**: 月次 audit (bug:trend + lint 群 + AUDIT 雛形) の定期実行化
- **deep-research skill**: 公式 Q&A (commmune) 新着裁定・カード個別 Q&A の体系的収集
- **context7 MCP**: ライブラリ設定変更・バージョン更新時は推測せず現行ドキュメントを引く
- **GitHub Actions CI** (.github/workflows/ci.yml): push/PR ごとに typecheck + vitest + lint 8本 +
  smoke を GitHub 側で実行 (トークン消費ゼロの常時回帰ゲート)。merge 前に CI green を確認する
- **Serena MCP** (.mcp.json): LSP ベースのシンボル単位ナビゲーション。大規模リファクタ
  (Phase 3a/3b 等) でファイル全読みの代わりに find_symbol / find_referencing_symbols を優先
- **firecrawl MCP** (.mcp.json、要 FIRECRAWL_API_KEY): JS レンダリングが必要な外部サイト
  (commmune 等) の構造化取得。まず playwright MCP / defuddle で足りるか検討してから使う

### レビューの right-sizing

- レビュー深度はフェーズのリスクに連動させる (低リスク=決定論検証+1 lens / 高リスク=フルパネル)
- ただし opus / Fable で行うほうが効果が見られる場面 (意味論・ルール整合の検証等) には積極的に使う
- reviewer に full vitest 等を再実走させない (メインループの実行結果をプロンプトで渡す)

### 決定論スクリプト優先

- **エージェントに確認させる前に、スクリプト (grep / hash / diff / node) で機械的に検証できないか必ず検討する**。
  機械で検証できるものはエージェントに依頼しない (例: fixture 統一は md5 分類 + one-shot script で実施)

### コンテキスト衛生 (1フェーズ = 1commit = セッション境界)

- フェーズ commit 後は NEXT-SESSION-PROMPT.md を再開可能な状態に更新し、
  1〜2 フェーズ消化したセッションは `/clear` での新セッション再開を推奨してターンを終える

## 自動生成ドキュメント運用 (`.claude/auto/`)

`.claude/auto/` 配下のファイルは `scripts/gen-docs/` により自動生成される。

- **編集禁止**: 手で書き換えても次回 `npm run docs:*` で上書きされる
- **唯一の例外**: `.claude/auto/README.md`（運用ガイド、手書き）
- **再生成コマンド**:
  - `npm run docs:api` — エンジン public API reference
  - `npm run docs:state` / `docs:flows` / `docs:progress` / `docs:mapping` — 各カテゴリ
  - `npm run docs` — 全部生成
  - `npm run docs:check` — 差分検知のみ（pre-commit hook が自動実行）
- **pre-commit hook**: `simple-git-hooks` で `docs:check` を自動実行。差分があるとコミット失敗 → `npm run docs` で再生成してから再コミット
- **詳細**: [.claude/auto/README.md](auto/README.md)

骨格凍結原則との整合: 自動生成はエンジン本体に手を入れずに行うため `scripts/gen-docs/` 配下のみ変更する。

## リスク・バグ管理表 運用 (Round 4a 導入)

全バグ・リスクは `.claude/bugs/` 配下に Obsidian Base 形式で管理する:

- 各バグは `.claude/bugs/BUG-XXX.md` に個別ファイル (frontmatter で `id` / `severity` / `category` / `status` / `round` / `date_found` を管理)
- 集約 view は **[.claude/bugs/index.base](bugs/index.base)** を Obsidian で開いて参照
  - 全バグ一覧 / 🔴 重大バグ / 🔧 現 Round 対応中 / ⏳ 未着手 等の view が用意済
- 解説 hub (RCA + 水平展開計画 + 凡例) は [.claude/specs/risk-and-bug-tracker.md](specs/risk-and-bug-tracker.md)

### 運用フロー

1. **新規バグ発見時**: `.claude/bugs/BUG-XXX.md` を作成 (frontmatter + 期待動作 + 実動作 + 関連ファイル + RCA + 水平展開 + 防止策)
2. **修正完了時**: 該当 BUG-XXX.md の `status` を `修正済` に更新、`commit` プロパティに commit hash 追記
3. **水平展開で発見した同種バグ**: 同 commit で修正 + 新規 BUG-XXX.md 追加
4. **Round 完了時**: session log に `.claude/bugs/index.base` view へのリンク掲載、Round 範囲のバグ進捗を要約

詳細な RCA + 水平展開計画は [.claude/specs/risk-and-bug-tracker.md](specs/risk-and-bug-tracker.md) を参照。

### 月次 audit 運用 (Phase 7-F 導入、収縮計画の cadence)

毎月末 or Round 完了時に手動実行:

1. `npm run bug:trend` で 5 再発パターン × 月次集計
2. `npm run lint:bugs` / `npm run lint:listener` / `npm run lint:card-addition`
   で各種規約違反を確認
3. [.claude/bugs/AUDIT-template.md](bugs/AUDIT-template.md) を雛形に
   `.claude/bugs/AUDIT-YYYY-MM.md` を作成
4. 新教訓が発見された場合 [.claude/bugs/LESSONS-LEARNED.md](bugs/LESSONS-LEARNED.md)
   に追記 (各教訓に「→ enforcement: <script名>」明示)
5. `.claude/reports/smoke-baseline.json` の threshold 妥当性を見直し

---

## メモリ運用ルール

- **作業時は必ず** `.claude/memory.md` に追記する
- 1セッションで何を判断・実装・修正したかを残す
- `.claude/memory.md` が **80行を超えそうなら**、内容を `.claude/sessions/YYYY-MM-DD.md` に移動して memory.md を空に近い状態へリセットする
- 同日内で2回以上分割が必要なら `YYYY-MM-DD-2.md`, `YYYY-MM-DD-3.md` と続ける

## ファイルサイズ制約

**全Markdownファイルは100行以内。** 超過する場合は分割する。

- ルール詳細 → トピック別に分割（`.claude/rules/`）
- セッションログ → 日付分割（`.claude/sessions/`）
- 設計ドキュメント → 機能単位で分割

## 関連ファイル・ディレクトリ

新しいセッション開始時は以下を順に確認すること:

1. `.claude/CLAUDE.md` — 本ファイル (規約 / 運用ルール)
2. `README.md` — プロジェクト紹介 + 起動方法 + 主要リンク集 (薄い、頻繁には変わらない)
3. **`CHANGELOG.md`** — 📜 Phase / Round 完了履歴 ("何ができたか")。最新の作業状況はここを最初に見る
4. **`.claude/auto/structure.md`** — 🗂 リポジトリ全フォルダ・全ファイル説明 (`npm run docs:structure` で自動生成、手で編集禁止)
5. `.claude/memory.md` — 現セッション scratchpad (進行中の作業ログ)

詳細仕様・履歴アーカイブ:

- `.claude/rules/` — 公式ルール抜粋（必読）
- `.claude/research/` — 設計判断のための調査結果
- `.claude/specs/INDEX.md` — Engine API / UI / カード分析 全 spec
- `.claude/sessions/` — 過去セッションの日次詳細ログ
- `.claude/bugs/index.base` — リスク・バグ管理表 (Obsidian Base)
- `.claude/auto/` — 🤖 自動生成ドキュメント全般 (api / state / flows / progress / mapping / structure)

## ドキュメント更新義務 (役割分離)

README.md は **薄く保ち** (紹介 + 起動 + リンク集のみ)、内容別に書き分ける:

| 何 | どこ | いつ更新 | 形式 |
| --- | --- | --- | --- |
| **何ができたか (履歴)** | `CHANGELOG.md` (生成物) ← `.claude/changelog-entries/<date>-<seq>-<slug>.md` (ソース) | Phase / Round 完了時にエントリ追加 | **半自動** (エントリ手書き → `npm run docs:changelog` で集約) |
| **構造・ファイル説明** | `.claude/auto/structure.md` | ファイル追加・削除時 | **自動生成** (`npm run docs:structure`、手書き禁止) |
| **日次作業ログ** | `.claude/memory.md` + `.claude/sessions/` | 作業中 | 既存運用通り (80 行で sessions/ にローテート) |
| **プロジェクト紹介・起動** | `README.md` | 技術スタック変更時のみ | 手書き、薄く保つ |
| **規約・手順** | `.claude/CLAUDE.md` (本ファイル) | 運用ルール変更時 | 手書き |

新しいセッションの Claude が `README.md` → `CHANGELOG.md` → `.claude/auto/structure.md` の 3 ファイルだけで「何をやっているプロジェクトか」「最新の状況」「どこに何があるか」を把握できる状態を保つこと。
