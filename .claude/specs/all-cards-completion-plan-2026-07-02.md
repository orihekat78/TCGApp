# 全カード追加 完了計画 (2026-07-02 / 同日改定: 二 Track 並行)

前提プロセス: [speed-rebalance-2026-07-02.md](speed-rebalance-2026-07-02.md) の 3-tier ゲート。
2026-07-02 ユーザー決定により **二 Track 並行** で進める (session も再開プロンプトも分離):

| Track | 専任 | driver | 再開プロンプト |
|-------|------|--------|---------------|
| **A** | engine 拡張 (E1→E2→E3→MR) + **exemplar カード同梱** | [engine-extension-plan-2026-06-30.md](engine-extension-plan-2026-06-30.md) | [NEXT-SESSION-PROMPT.md](../NEXT-SESSION-PROMPT.md) |
| **B** | カード追加ツール (text→DSL compiler) + 一括 author | [compiler-track-plan-2026-07-02.md](compiler-track-plan-2026-07-02.md) | [NEXT-SESSION-PROMPT-TRACK-B.md](../NEXT-SESSION-PROMPT-TRACK-B.md) |

## 現在地 (2026-07-02、origin/main 実測)

- カード universe **2049** printings / 実装済 **1514** (73.9%) / **残 535**。
- engine 拡張 (plan TSV 85 prim): E1 pure-additive 50 (出荷+stale ≈25 消化済) / E2 structural 32 (sole 106) / E3 risky 3 (sole 20) / MR (設計済)。

## 現在の完了フェーズ (2026-08-24)

- 上記 2026-07-02 数値は実装計画の履歴値。現在は全カード Q&A 検証を
  [qa-adjudication/WORKFLOW.md](qa-adjudication/WORKFLOW.md) で完了させる段階。
- 公式 Q&A 2964 件中 1618 matched / 1346 test-missing。残 1127 exact
  groups、うち singleton 949 groups。
- 通常は20-30件/Wave。各Waveは局所テストのみ。2 Waveごとに型・lint・
  QA整合を1回実行し、1 commit / 1 push。フル回帰は10 Waveごと、T3、公開前。
- 残工数は81-154実作業時間、中心値約117時間。10 Waveごとに実測補正する。

## Track A: engine 拡張 — 10-12 session

| Ph | 内容 | Tier | wave 構成 | 解禁 | session |
|----|------|------|----------|------|---------|
| A1 | E1 残 additive 裾 (~25 prim、大半 effort S) | T1 | mega-wave 10-15 prim × 2 | sole ~35-45 | 1-2 |
| A2 | E2 structural — subsystem cluster: ①observer 群 ②keyword-turn-track 群 ③verb 群 ④leave/cond 群 ⑤小物残 | T2 | cluster = 1 wave (3-6 prim) × 5 | sole ~65 | 3-4 |
| A3 | E2 大物: G39 partner-area カード枠 (24) / G37 scope 配列 (15) | T3 | 単独 wave × 2 | sole ~39 | 2 |
| A4 | E3 risky: P10 alt勝敗 (15) / P11 / G14 | T3 | 単独 wave × 2-3 | sole ~20 | 2 |
| A5 | MR partner-area (G42、spec 済 4 フェーズ) | T3 | spec 通り | ~15 | 2 |

各 wave に **exemplar カード 1-2 枚を同 commit 同梱** (E2E 生きたテスト + Track B の oracle 入力/文法 spec)。

## Track B: カード追加ツール + 一括 author — 5-9 session

| Ph | 内容 | gate | session |
|----|------|------|---------|
| B0 | harness: corpus 抽出 + shipped DSL 正規化 loader + oracle diff runner (全部決定論 script) | T1 | 1 |
| B1 | 文法 core (句分割 + production rule + 裁定テーブル) → **G1: 1514 oracle で silent mismatch 0**。文法へ敵対 review 1 回 | T2 | 1-2 |
| B2 | **progressive bulk**: 出荷済 primitive の family から一括 compile、60-80 枚/commit、未知句 refuse→DEFER | T1/T2 | 2-4 |
| B3 | refuse queue 手動 certify + Q&A 依存 except リスト化 → 「全カード実装完了 (except リスト付き)」宣言 | T2 | 1-2 |

## 同期ゲート / 並行運用

- **A→B interface**: exemplar カード = 新 primitive の機械可読 spec + oracle 入力。**production rule 登録は B 専任** (A は書かない)。
- **G1 (bulk 解禁ゲート)**: oracle 実測 (match/refuse/mismatch) で mismatch 0 になるまで B2 開始禁止。
  **G1 実測が出るまで総 session 数は確定しない** (楽観前科: reusable 306→実2 / green 211→歩留 40%)。
- **B2 family 制約**: 「1 wave 以上前に main 出荷済み primitive」の family のみ → A の exemplar と card/barrel 衝突なし。
- **G2 (最終)**: A5 完了 + B 文法が全 primitive 被覆 → 最終一括 sweep + B3 精算。
- 衝突回避: A = `src/engine/**`+exemplar / B = `scripts/compiler/**`+bulk cards。両者 worktree 隔離 + FF push。
  B が engine 不足を発見しても触らず DEFERRED-INDEX 経由で A へ送る (骨格凍結)。

**合計 ≈ 15-21 session、並行 2 session 運用で暦上 ~10-13 slot** (直列旧計画 20-27 比 ~半減)。

## リスク

- **clone/compile 照合の見逃し** → validate-specs whitelist (未登録 field=fail) + 決定表 diff + refuse 原則 (partial 変換禁止)。
- **sole 数の上振れ** → 着手前 origin/main 実 grep 継続。毎 phase 末 burn-down 補正。
- **決定論 classifier の楽観前科** → G1 oracle 実測を通過するまで数字を確定しない。
- **G39/G37/P10 の regress** → T3 フルゲート据置。smoke baseline + probe が床。
- **Q&A 依存カード** → 完了宣言は「except リスト付き」を正とする。裁定が出次第 個別解禁。

## 完了定義

- 2049 printings 全てが (a) 実装済 or (b) except リスト (公式裁定待ち / エラッタ待ち) に載る。
- 骨格凍結到達: 骨格 PR / 月 = 0 (カード追加が engine に触れない状態)。
