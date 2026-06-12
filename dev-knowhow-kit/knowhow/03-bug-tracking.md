# 03. バグ管理 — 1 バグ 1 ファイル + Obsidian Base + 教訓の能動化

BUG-001〜127 で実運用した体系。templates/ に BUG-template.md / AUDIT-template.md / index.base 同梱。

## 1 バグ = 1 ファイル（BUG-XXX.md）

- `.claude/bugs/BUG-XXX.md`（3 桁連番）。frontmatter（同梱 lint の必須/enum と一致）:
  `id / title / severity(重大|高|中|低|軽微) / category(5〜8 enum を自分で定義) /`
  `status(未着手|対応中|修正済|見送り|仕様外) / round(スプリント名) / date_found / reporter /`
  `date_fixed・commit(修正済のみ必須) / related / recurrence_cluster(任意)`
- 未修正バグの本文 5 セクション必須: **①期待動作 ②実動作（再現手順 + file:line）③関連ファイル ④RCA ⑤水平展開**
- 修正済へ遷移したら 20 行未満のサマリに緩和可（commit が一次情報源になる）。
  ただし重大バグ・仕様解釈が絡んだもの・連鎖発見したものはフル記述を残す
- **なぜ 1 ファイルか**: 巨大な 1 枚表は編集衝突・diff 汚染で必ず腐る。
  ファイル単位なら git と 1:1 で紐づき、frontmatter が lint と集約 view の両方に効く

## 運用フロー

1. 発見時: BUG-XXX.md 作成
2. 修正完了時: status=修正済 + **commit hash + date_fixed を同一コミットで** 反映
3. 水平展開で見つけた同種バグ: 同 commit で修正 + 新 BUG 起票 + related で相互リンク
4. スプリント完了時: セッションログに進捗要約

## Obsidian Base 集約ビュー（index.base）

- frontmatter を自動集約する YAML 定義。手動メンテ一切不要（「ファイルを作る」以外の作業ゼロ）
- 構成: filters（対象フォルダ）/ formulas（severity→🔴🟠🟡🟢、status→✅🔧⏳ 絵文字変換）/
  views（全件 table・重大のみ・未着手のみ・現スプリント・日付順 cards の 5 view）
- 同梱の index.base は enum 値と「現スプリント」view のスプリント名を置換すれば動く
- Obsidian を使わない場合: 同じ frontmatter を読む集計スクリプトで md 表を生成（bug-trend のパーサ流用）

## frontmatter lint による強制（同梱 lint-bug-frontmatter.ts）

- 必須フィールド欠落 = error、enum 外 = error、**修正済なのに commit 空/TBD = error**
- pre-commit で実行 → 違反コミット不能
- **動機**: lint なしの 6 ヶ月で「commit 未記載 12 件 / category 22 種乱立」が発生。
  ドキュメント規約は機械強制しない限り必ずドリフトする
- 実装の罠: frontmatter パーサは `\r?\n` で CRLF 対応必須（Windows）

## LESSONS-LEARNED → enforcement 連鎖（教訓の能動化）

- 複数バグを横断した「教訓」を番号付きで LESSONS-LEARNED.md に蓄積
- 各教訓は 3 点セット: **該当 BUG（複数）/ 本文 / → enforcement: <script 名 or passive doc>**
- 末尾に「教訓 | enforcement」対応表。passive のままの行 = 将来 script 化する候補リスト
- **実証**: lint 化した教訓は物理的に再発不能になった。passive doc のままの教訓は再発し続けた。
  「文書に書くだけの教訓は AI も人間も次セッションで読まない」が前提
- 同種バグが 2 回再発した時点でそのパターン専用 lint を 1 本書く（先回り lint 化はしない —
  実際に起きた failure だけが lint になっているから形骸化しない）

## 月次 audit + 再発トレンド集計

1. `npm run bug:trend` — 全 BUG の frontmatter + RCA 本文をキーワードで 3〜5 の再発クラスタに
   自動分類し「月 × クラスタ」表を出力（enforcement の効果測定: 入れた lint でクラスタが減ったか）
2. 各 lint 実行 → AUDIT-YYYY-MM.md 作成（AUDIT-template.md 同梱）
3. 新教訓を LESSONS-LEARNED に追記（enforcement 欄必須）
4. ベースライン閾値の見直し

## 系レベルの水平展開（hub 文書）

個別バグを超えた「系」を 1 つの hub 文書（risk-and-bug-tracker.md 相当）で管理:

- 「N 次元 × M 経路」マトリクスで網羅状態を ✅/要確認 で可視化（同型の穴を体系的に潰す）
- 発見漏れが起きたら **プロセス自体の RCA** も表形式で記録
  （バグ / 既存実装 / 既存テスト / なぜ検出できなかったか）

## 移植手順

templates/ の 3 ファイルをコピー → enum を自プロジェクトの語彙（5〜8 個）に再定義 →
lint-bug-frontmatter.ts の Set を書き換え → pre-commit に配線（→ knowhow/04）。
