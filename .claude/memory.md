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

## 2026-06-15 セッション⑪ — トリアージ出荷バッチ#1 (確定green 56枚) + window4 並行

ユーザー選択「両方 (出荷 + window4並行)」。出荷トラックをメインに完遂。

### 出荷 (ALL_CARDS 1211→1267、commit 予定)
- windows1-3 の確定 green 25 distinct rep + **byte同一 clone 31** = **56枚**。新 engine クラスタ不要。
- **clone 安全弁**: sweep signature() が lossy (色/数/特徴抽象化) → cloneTargets は別テキストの可能性。
  新規 `scripts/survey/verify-clone-identity.cjs` で effect/cutIn/hirameki/henso byte 比較し同一のみ採用 → divergent 7除外
  (B05016小嶋元太 of B03086伊達航 等)。`build-verified-codegen-input.cjs` で codegen 入力構築 (collect-greens の unsafe blind-clone 不使用)。
- **codegen 修正** (`taskA-codegen.cjs`): certify spec の ability-level ruleRefs 欠如時に card-level fallback 注入 (reuse-batch.test fail 解消)。
- **B07098/P DEFER 解除**: count-dyn 不在で defer 済 → `forEach over:{all,query:{area:'remove',filter:{keyword,color}}}` で回避。
  engine candidates.ts:160 + BUG-122 が honor を静的確認 + runtime decoy 44 assert 実証。DEFERRED-INDEX 解禁マーク。build スクリプトに DEFER ガード追加。
- **gate5 実機検証**: 新規 `tests/cards/triage-greens-2026-06-15/` 25 files / **172 tests** (各 decoy + 負ケース、BUG-117/118 per-card 閉)。
  Workflow opus fan-out (1回目 25並列 + window4 同時 → server rate-limit で 22失敗、window4 停止 + SUB=5 で 22 retry → 全 clean-green)。
- 検証: validate-specs 56/56 / tsc clean / vitest **2404 pass 0 fail** / smoke baseline 不変 / playwright 119 / lint errors=0。

### window4 (並行スイープ、停止済)
- greenN=22 + gate-sample 10 = 32 抽出 → 24 certify完了で停止 (rate-limit 回避のため retry 中に停止)。green 4 (B01052/B04022/B02025/B04031 全 verify.ok)。
- false-green 率依然高く doc 結論再実証。残8 + 4新green は次セッション。`.tmp/certify/` durable。

### 次セッション
- バッチ#2: window4 の 4新green + 残8 certify → clone検証 → 出荷。スイープ継続 (window5+)。
- 中型 engine クラスタ着手も選択肢 (cutin-subtype filter 69枚 等)。
