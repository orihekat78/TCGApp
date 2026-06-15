# トリアージ・スイープ (2026-06-15) — 全未実装カードの現行engine再分類 + ゴール地点確定

目的: 未実装カタログ **全体** を gate 別に分類し「あと正確に N クラスタ」+ 大型ゲートの設計順序を確定する。
旧 [engine-gate-triage-2026-06-15.md](engine-gate-triage-2026-06-15.md) は次クラスタ選定 ranking。本ファイルは **全 universe スイープ**。

## 方法 (2層 + loop-until-dry)
1. **決定論スイープ** `scripts/survey/sweep-2026-06-15.ts` (再現可能): catalog(TSV) − live ALL_CARDS → 残カードを
   signature クラスタ化 → 現行 engine gate 一覧で再分類。出力 `.tmp/sweep/landscape.json` + `certify-queue.json`。HEURISTIC。
2. **per-card certify** `scripts/wf-certify.mjs` (opus grounding→敵対 refute) = 真の正本。grounding は **`.tmp/taskA/certify-brief.md`
   (現行engine版を新規作成、cap-map 2026-06-06 の stale ⛔ を訂正)**。
3. **loop-until-dry**: certify の yellow が暴く NEW gate を決定論 regex に還元→再実行→green を honest 化→再サンプル。

## 重大教訓 (このスイープの核心)
- **certify grounding の `capability-map.txt` が 2026-06-06 で stale** だった (cluster1-14 解消ゲート未反映)。certify-brief を現行化して回避。
- **決定論 green-candidate の false-green 率 = window2 65% → window3 55%** (NEW gate 還元で改善するが緩慢)。
  決定論分類は信用できない (card-wave 教訓を再実証)。**毎窓で新 gate ~8 を発見 = green bucket は多様な小ゲートの長い裾**。

## landscape (window1-3 の NEW gate 還元後, ALL_CARDS=1211)
- catalog **2049** / implemented **1211** / **remaining 838 cards / 485 distinct signature**
- 🟢 green-candidate (gate未検出): **236 sig / 378 cards** ← 真の green-now は false-green 55% 補正で **~170 cards 規模** (要 per-card certify)
- 🟡 yellow: **234 sig / 433 cards** ・ ⚫ black: **15 sig / 27 cards**

### 高yield engine gate (sig / cards) — ★=certify確認済
| gate | sig | cards | 規模 | 備考 |
|------|----:|------:|------|------|
| ★cutin-subtype (ability-subtype presence) | 36 | 69 | M | 「【カットイン】AP+」を持つ filter 不可 |
| grant-textual ability + ★set-card→host | 24+6 | 60 | M | 非キーワード能力テキストの継続/set経由付与 |
| ★contact-removal-by-self trigger | 27 | 51 | M | 「(このキャラとの)コンタクトによってリムーブされたとき」leave payload に攻撃者uid無 (反撃カード一族) |
| ★hand→deck-bottom / hand-size dyn / variable-count | ~20 | ~45 | M | draw.n/discard.n dyn無、hand出口は discard のみ |
| ★scene→deck / FILE-zone (partial, 一部green) | ~26 | ~47 | partial | sceneToDeck実装済、compound/相手側/atomic-N で yellow |
| ★stacked-card identity ops | ~6 | ~12 | S-M | stackedCards は count のみ (identity/transfer/sum/cost不可) |
| ★remove→deck-bottom effect (selective/self) | ~5 | ~10 | S | removeAreaAllToDeckBottom は両者全件、selective EFFECT verb 無 |
| **partner-area-structure** ★ | 15 | 27 | **XL** | PlayerState slot 無 (ビッグジュエル/MR列挙) |
| **loseGame / partner-ability-rewrite** | 5 | 17 | **XL** | 勝利条件ロジック改変 |
| **name-designation** ★ | 8 | 15 | **XL** | 「カード名を1つ指定」宣言UI+比較condition |
| ★usage-restriction (cutin/変装/event ban) / untargetable / next-hint-source | ~20 | ~30 | S | continuous-aura以外のban機構無 等 |
| 長尾 ~20 niche gate (各1-6sig) | ~60 | ~80 | mixed | evidence-peek/souza-discovered/play-event/deck-choose/mustGuard/janken/MR-filter/color-override 等 |

(完全データ `.tmp/sweep/landscape.json`、再生成 `npx tsx scripts/survey/sweep-2026-06-15.ts`)

## certify 結果 (windows 1-3 = 88 rep → green 26 / yellow 62)
- **確定 green (即 codegen 可, 25枚)**: B01018 B01062 B01066 B02003 B02005 B02019 B02044 B02077 B03005 B03025 B03086 B03089 B04014 B04017 B05006 B05020 B05046 B06011 B06013 B07004 B07020 B07023 B07098 D09004 PR060
- **green needsManual (closure要, 1枚)**: D10003
- **certify が決定論で捕捉不能な NEW gate を ~27 発見** → sweep regex 還元済 (green 299→236):
  contact-removal-by-self / next-hint-source / hand-size-dyn / deck-bottom-reveal / scene→evidence / event-self-set /
  color-override / cutin・変装ban / hand→deck-bottom / set-card→host-ability / stacked-card-identity /
  selective-remove→deck / continuous-level-set / set-card-count-condition / used-card-attr-dyn / action-eligibility-ban 他

## ロードマップ (N クラスタ — green bucket 収束後に最終確定)
- **green-now ≈ 398 cards の ~35% (=~140 cards) + α**: 新engineクラスタ不要、card-wave バッチで出荷 (要 per-card certify、false-green 65% のため必ず踏む)。
- **残 engine-extension クラスタ (高yield順、共有プリミティブ先行)**:
  1. **cutin-subtype filter** (ability-subtype presence) — 69枚、単一 filter 拡張で高yield
  2. **contact-removal-by-self trigger** — 51枚、leave:to-remove に攻撃者uid付与 or contact:judge公開
  3. **grant-textual ability + set-card→host** — 60枚、非キーワード能力の継続付与機構
  4. **dynamic-count family** (hand-size dyn + variable-count + hand→deck-bottom) — ~45枚
  5. **scene→deck / FILE-zone 残** — partial、certify で green 分離後に残りを cluster 化
  6. **stacked-card identity** / **selective-remove→deck** — 中小
  7. **大型構造 ×3 (最終段)**: partner-area / name-designation / loseGame-rewrite — XL・要専用設計パス・回帰大
- **長尾 ~20 niche gate**: 各1-6枚、defer or 機会的 bundle。
### N の確定 (ゴール地点)
- **意味ある engine-extension クラスタ = 高yield中型 ~6 + 構造XL ×3 ≈ 9-12 クラスタ**。これがロードマップの幹。
- **+ 長尾 ~30 niche gate (各1-7枚)**: 大半 defer or 機会的 bundle。全 gate 数は多い (~45) が大半が極小。
- green-now ≈ 170 cards 規模 (false-green 55% 補正): **新クラスタ不要、card-wave バッチで都度 certify→codegen 出荷**。
- ⚠ green bucket は毎窓で新 gate を産み収束が緩慢 → **exhaustive 全 certify より「出荷バッチ時の per-card certify」が実際的** (この結論自体がスイープの成果)。

## certify 進捗 / 再開
- queue `.tmp/sweep/certify-queue.json` (485) / recs `.tmp/taskA/recs/<rep>.json` (485) / verdict `.tmp/certify/<rep>.json` (durable, .tmp は session間で消える可能性あり)
- ✅ window1 (26, gate boundary) / ✅ window2 (30, false-green 65%) / ✅ window3 (32, false-green 55%) = 計 88 rep certified
- 次 window 抽出: `node scripts/survey/sweep-window2.cjs <greenN>` (done除外、green層化) → id配列を wf-certify に渡す。
  新 yellow が暴く gate を `sweep-2026-06-15.ts` の GATES に regex 還元 → 再実行で landscape 更新 (loop-until-dry)。
