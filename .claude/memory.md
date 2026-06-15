# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-15-4.md = セッション⑦⑧⑨)

## 2026-06-15 セッション⑩ — トリアージ・スイープ (ゴール地点確定、multi-window)

ユーザー依頼: 未実装カード全体を gate 別に分類し「あと正確に N クラスタ」+ ロードマップ確定。
正本 doc = [.claude/specs/triage-sweep-2026-06-15.md](specs/triage-sweep-2026-06-15.md)。

### 方法 (2層)
- **決定論スイープ** `scripts/survey/sweep-2026-06-15.ts` (再現可能): catalog(TSV 2049) − live ALL_CARDS(1211) → 残838/485sig を
  signature クラスタ化 → 現行 engine gate 一覧で再分類。出力 `.tmp/sweep/landscape.json` + `certify-queue.json`。
- **per-card certify** `scripts/wf-certify.mjs` (opus grounding→敵対 refute) = 真の正本。決定論は HEURISTIC。

### 重大発見 (基盤の stale)
- certify が grounding する `capability-map.txt` が **2026-06-06 (ALL_CARDS=978) で stale**。cluster1-14 解消ゲートを誤判定する。
- 対策: live src/engine から現行 capability を機械抽出 (verb54/cond15/filter14/hook/cost14/aura4) → **`.tmp/taskA/certify-brief.md` を現行版で新規作成**
  (.tmp は gitignore のため都度再生成)。解消済ゲート一覧 + exemplar 付き、「cap-map の stale ⛔ を訂正・live grounding 必須」を明記。

### 決定論 landscape (window1 反映後)
- 残 838 cards / 485 sig: 🟢 **green-candidate 281 sig / 460 cards** (要 certify) / 🟡 yellow 189/351 / ⚫ black 15/27。
- green-candidate 460 = **新engineクラスタ不要** (card-wave バッチで出荷)。残 engine クラスタ = yellow/black gate 群。

### certify 進捗 (windows 1-3 = 88 rep → green 26 / yellow 62)
- **w1 (26, gate boundary)**: green4/yellow22。partial gate は大半が本物。NEW gate 14 発見。
- **w2 (30, green20較正+gate10)**: green9/yellow21。**false-green 率 65%**。contact-removal-by-self trigger 等 NEW gate 発見。
- **w3 (32, 改善分類器で green再サンプル)**: green14/yellow18。**false-green 率 55%** (改善も緩慢)。mill-bind/stunChar/setcard:enter 等 NEW gate。
- 累計 **NEW gate ~27 発見** → `sweep-2026-06-15.ts` GATES に regex 還元 (green-candidate 299→236)。
- 確定 green 25枚 (codegen可) + D10003 (needsManual)。一覧は triage-sweep doc。

### 結論 (ゴール地点)
- **意味ある engine クラスタ ≈ 9-12** (高yield中型~6: cutin-subtype/contact-removal/grant-textual+set-card/dynamic-count/scene+FILE残/stacked-identity
  + 構造XL×3: partner-area/name-designation/loseGame-rewrite) + 長尾 ~30 niche gate (大半 defer)。
- green-now ≈ 170cards 規模。**毎窓で新 gate 発生し収束緩慢 → exhaustive 全certify より「出荷バッチ時の per-card certify」が実際的** (= スイープの結論)。

### 次セッション
- スイープ継続 (window4+ で green 収束、loop-until-dry) or 確定 green 26枚を card-wave 出荷開始。
- 再開: `node scripts/survey/sweep-window2.cjs <greenN>` → wf-certify に id 配列。`.tmp/certify/` durable (session 間で消える可能性、その場合 recs/queue から再 certify)。

### ロードマップ暫定 N
- 大型×3: partner-area / name-designation / loseGame-rewrite。
- 中型×4-5 (共有プリミティブ先行): cutin-subtype(ability-subtype filter 36sig) / grant-textual+set-card-ability(30) /
  dynamic-count family (hand-size dyn+variable+hand→deck) / usage-restriction family / scene+FILE 残。
- 長尾 ~20 niche gate (各1-6枚) = 多くは defer or 機会的 bundle。
