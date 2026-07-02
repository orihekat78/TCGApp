# 全カード追加 完了計画 (2026-07-02)

前提プロセス: [speed-rebalance-2026-07-02.md](speed-rebalance-2026-07-02.md) の 3-tier ゲート。
engine-first 方針 (2026-06-30 ユーザー決定) は維持。ただし各 engine wave に
**exemplar カード 1〜2 枚を同 commit で同梱** (E2E 生きたテスト + 後の clone certify の原器。再 certify の二度手間を消す)。

## 現在地 (2026-07-02、origin/main d54524da 実測)

- カード universe **2049** printings / 実装済 **1514** (73.9%) / **残 535**。
- engine 拡張 (plan TSV 85 prim): E1 pure-additive 50 (出荷済+stale ≈25) / E2 structural 32 (sole 106) / E3 risky 3 (sole 20) / MR (設計済)。
- 残 535 の内訳: 単一 gate (sole) ≈235 / 複数 gate 複合 + ENGINE0 複雑裾 ≈150 / clone・P variant 群 (解禁時に随伴) ≈150。

## フェーズ計画

| Ph | 内容 | Tier | wave 構成 | 解禁/出荷 | session 目安 |
|----|------|------|----------|----------|-------------|
| **1** | E1 残 additive 裾 (~25 prim、大半 effort S) | T1 | mega-wave 10-15 prim × 2 | sole ~35-45 | **1-2** |
| **2** | E2 structural — subsystem cluster 化: ①observer 群 (P21/P22/P19/G06) ②keyword-turn-track 群 (P15/P16/P17/G32) ③verb 群 (P18/P47/P40/P38) ④leave/cond 群 (P02/P03/G14/P36/P52/P53) ⑤小物残 | T2 | cluster = 1 wave (3-6 prim) × 5 | sole ~65 | **3-4** |
| **3** | E2 data-model 大物: G39 partner-area カード枠 (24) / G37 scope 配列 (15) | T3 | 単独 wave × 2 | sole ~39 | **2** |
| **4** | E3 risky: P10 alt勝敗 (15) / P11 partner全色+cap / G14 | T3 | 単独 wave × 2-3 | sole ~20 | **2** |
| **5** | MR partner-area (G42、spec 済 4 フェーズ) | T3 | spec 通り | ~15 | **2** |
| **6** | **カード大量 author**: family clustering → exemplar フル certify → clone 決定表 diff。engine 解禁分 + 複数 gate 複合 + ENGINE0 複雑裾 | T1/T2 | 30-60 枚 / session | **~535 全部** | **9-13** |
| **7** | tail 精算: Q&A 依存 (公式裁定待ち) / DEFERRED-INDEX 残 / 既知エッジ受容リスト化 → 「全カード実装完了 (except リスト付き)」宣言 | - | - | - | **1-2** |

**合計 ≈ 20-27 session** (現行ペース比 ~1/3。現行: 1 session = 1-5 prim or 10-16 card → 50+ session 相当)。

## Phase 6 (カード大量 author) の実行形

1. 解禁カードを **pattern family に機械分類** (既存 gap-marker classifier + engine-extension TSV の label→ids)。
2. family ごとに exemplar 1 枚フル certify (grounding 全列 + probe test) — engine wave 同梱分は既済。
3. 残 clone を codegen → **決定表 diff スクリプト** (DSL フィールド ⇔ TSV 印字列) で全数機械照合 + 10 枚に 1 枚 spot-check。
4. 6 ゲート → 1 commit 20-40 枚 → CI green → 次 family。
5. UI 新部品「型」が生えた family のみ playwright 1 回。
6. ルール裁定不明カードは即 DEFER (公式 Q&A 送り) — 止まらない。

## 並行セッション運用

- engine wave (Ph1-5) = worktree 隔離 / card wave (Ph6) = family 単位 partition (同 family を 2 session で触らない)。
- Ph1-2 と「stale-DEFER 再検査 + 既解禁 clone 刈り」card session は並行可。Ph3-5 (T3) は engine 側単独。

## リスクと手当て

- **clone 照合の見逃し** → 決定表 diff は捏造フィールド検出 (whitelist 外 key で fail) を含める ([[feedback-certify-spec-self-review]] 教訓)。
- **sole 数の上振れ** → 着手前 origin/main 実 grep は継続 (安い)。目安値は毎 phase 末に burn-down で補正。
- **G39/G37/P10 の regress** → T3 フルゲート据置。smoke baseline + probe が床。
- **Q&A 依存カード** → 完了宣言は「except リスト付き」を正とする。公式裁定が出次第、個別解禁。

## 完了定義

- 2049 printings 全てが (a) 実装済 or (b) except リスト (公式裁定待ち / 公式エラッタ待ち) に載る。
- 骨格凍結到達: 骨格 PR / 月 = 0 (カード追加が engine に触れない状態)。
