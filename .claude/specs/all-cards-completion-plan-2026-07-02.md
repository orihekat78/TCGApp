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
| **6-0** | **text→DSL compiler 構築**: whitelist 文法 (句形→DSL 断片 production、未知句 refuse) + **oracle 実測** (実装済 1514 枚 compile⇔shipped DSL diff、535 への適用率計測) | T1/T2 | tool + 文法 review 1回 | - | **1-2** |
| **6** | **カード大量 author**: compiler 一括変換 → refuse 分のみ手動 certify (family exemplar + clone 決定表 diff) | T1/T2 | 一括 + refuse 裾 | **~535 全部** | **2-4** (oracle 実測で確定) |
| **7** | tail 精算: Q&A 依存 (公式裁定待ち) / DEFERRED-INDEX 残 / 既知エッジ受容リスト化 → 「全カード実装完了 (except リスト付き)」宣言 | - | - | - | **1-2** |

**合計 ≈ 14-19 session** (compiler 成功時。oracle 実測前の保守値 = 20-27。現行ペース 50+ session 相当比 ~1/3〜1/4)。

## Phase 6 の実行形 — text→DSL compiler (2026-07-02 ユーザー提案で改定)

誤訳の源 = AI の即興翻訳 → **whitelist 文法 compiler** で構造排除 (一致句のみ変換、**未知句は refuse → DEFER queue**。silent 誤訳が構造的に不可能になり、裁定は文法に 1 回だけエンコード)。

1. **production rule の漸進登録**: Ph1-5 の各 engine wave が自 primitive の cardTextPattern→DSL 断片 rule を
   exemplar カードと同 commit で lexicon 登録 (文法構築コストを wave に償却、Ph6-0 到達時にほぼ完成)。
2. **Ph6-0 = compiler 組立 + oracle 実測**: 実装済 **1514 枚**の印字テキストを compile → shipped DSL と正規化 diff
   (ground-truth oracle)。一致率 + 残 535 適用率を計測してから以降の session 数を確定。文法自体に敵対 review 1 回 (T2)。
3. **一括 compile**: 生成 DSL は validate-specs whitelist + 決定表 diff で機械検証。1 commit 60-80 枚。
4. refuse queue のみ手動 certify (family exemplar + T2)。UI 新部品「型」が生えた family のみ playwright 1 回。
5. engine honor gap (BUG-117 型: DSL 正しくても engine が未評価) は compiler 守備範囲外 → exemplar probe test が担保。
6. 真の裁定不明カードは即 DEFER (公式 Q&A 送り) — 止まらない。

## 並行セッション運用

- engine wave (Ph1-5) = worktree 隔離 / card wave (Ph6) = family 単位 partition (同 family を 2 session で触らない)。
- Ph1-2 と「stale-DEFER 再検査 + 既解禁 clone 刈り」card session は並行可。Ph3-5 (T3) は engine 側単独。

## リスクと手当て

- **clone 照合の見逃し** → 決定表 diff は捏造フィールド検出 (whitelist 外 key で fail) を含める ([[feedback-certify-spec-self-review]] 教訓)。
- **sole 数の上振れ** → 着手前 origin/main 実 grep は継続 (安い)。目安値は毎 phase 末に burn-down で補正。
- **決定論 classifier の楽観前科** (reusable 306→実2 / green 211→歩留 40%) → compiler は **oracle 一致率の実測を通過するまで** session 数を確定しない。
- **G39/G37/P10 の regress** → T3 フルゲート据置。smoke baseline + probe が床。
- **Q&A 依存カード** → 完了宣言は「except リスト付き」を正とする。公式裁定が出次第、個別解禁。

## 完了定義

- 2049 printings 全てが (a) 実装済 or (b) except リスト (公式裁定待ち / 公式エラッタ待ち) に載る。
- 骨格凍結到達: 骨格 PR / 月 = 0 (カード追加が engine に触れない状態)。
