# 全カード完了 roadmap — 10-15 session 圧縮プログラム (2026-07-10 起票)

> user 指示「圧縮レバー全部効かせて ~10-15 session で完了したい」に基づく driver。
> 毎 session 開始時に本ファイルの進捗列を確認し、完了 session に ✅ を付けて commit する。

## 在庫の真実 (2026-07-10 機械実測)

残 325 printings の構造 (corpus 2074 − shipped 1749):

| 区分 | 数 | 性質 |
|---|---|---|
| P-spread 即可 | ~40 | base 出荷済 + TSV 全列同文 → `node scripts/gen-p-spread.cjs` で機械 clone (S1 で 39 出荷、B05086P はデータ差で除外) |
| in-pool DEFER | 177 printings = **163 unit** | 真の作業対象。全 unit が DEFERRED-INDEX 記載済 |
| base 未出荷の P | 108 | base 出荷と同時に ride-along (随伴 spread) |

**実作業 = 163 unit。1 unit 出荷 ≈ 平均 2 printings 進む。**

## 圧縮レバー (常時適用)

1. **随伴 P-spread**: 毎 session 末尾に `node scripts/gen-p-spread.cjs --dry` → 生成 → 同 commit。base が出れば P はタダ
2. **夜間自走**: 1 session = mini-wave 2-4 本連続 (実証済: mini-wave #1-3 を1晩)
3. **並列 lane**: 衝突面 = _reuse/index.ts (append-only) + docs のみ → 2-3 lane 並走可
4. **UI は cluster 単位で1回だけ作る**: PA batch / deck-window / cost-choice は UI 出荷後 clone 同然
5. tier 規約 (2026-07-02) 維持: T0=機械 / T1=+意味等価 lens / T2=2 lens / T3=フル+Playwright

## session 割当 (bucket = DEFERRED-INDEX 実測 cluster)

| S | bucket | unit≈ | printings≈ | tier |
|---|---|---|---|---|
| ✅S1 | P-spread 39 + mini-wave #5 (B03049+P fromBottom / B05047 deckPlaceSplit) + roadmap — **実績 42 printings (1749→1791)** | 2 | 42 | T0+T2 |
| ✅S2 | deck cluster: B01022 (T3 window-pick UI) + B01093 + B08057 + B02072/P — **実績 5 printings (1791→1796)**。D06013 は T3 pre-walk 2点修正が必要と grounding 確定 → S3+ 単独枠へ持ち越し | 4 | 5 | T2-T3 |
| S3 | **re-triage sweep**: yellow ~12 + INDEX未記載 ~39 unit を機械 batch 再分類 → easy 刈り取り | ~15 | ~20 | T0-T2 |
| S4 | set-card cluster: PR234+240 / B02084 / B01057 / B02013 / B02031 / B02039 / B08008 / D10009+10 | 9 | ~12 | T2 |
| S5 | PA batch (宣言19+発動5 UI 一括) + PR263+269 / B07061 / B09055 / B07049 | ~12 | ~28 | T3 |
| S6 | intercept ⑦ (B02067/B04003/B08081) + attribution (B03116/B04089/B01070/B05009+D10022/B03040) | 8 | ~10 | T2-T3 |
| S7 | dyn/counter (B09019/B08068/B07102/B04084/B09105) + cutin-content filter (D06003 群 4) | 6 | ~10 | T2 |
| S8 | case cluster (事件 14 unit: B05118+119/B06106-108 群ほか) | ~8 | ~18 | T2 |
| S9 | 大物 A: B03111 / B04073 / PR284 / B02022 / B01020 | 5 | ~6 | T2-T3 |
| S10 | 大物 B: B01092 / B09112 / B06042 / B06020 + stacked-identity (B08003/B06005/B08019/B08074) | 8 | ~9 | T2-T3 |
| S11 | B09027 cost-choice UI (T3) + 残 touch-up (B06085 faceUp 等) | 3 | ~4 | T3 |
| S12 | 尾 sweep: S3 re-triage の残 + Track B re-mine + vanilla rerun | ~15 | ~25 | T0-T2 |
| S13-15 | buffer (yield 未達分の持ち越し / bug budget 回収 / 最終 audit) | — | 残り全部 | — |

合計見込み: 163 unit → 285 printings + spread 40 = **325 (完了)**。

## 不確実性 (S3 で解消)

- yellow ~12 + INDEX未記載 ~39 unit = 最大の未知。S3 の機械 re-triage (prepare 拡張 or 専用 script) で
  「実は easy」と「真の大物」に二分してから S4 以降の割当を補正する
- PA batch の printings は宣言19+発動5 の重複を S5 着手時に実測確定

## 進捗記録規約

- session 末: 本表の該当行に ✅ + 実績数を追記、NEXT-SESSION-PROMPT の現在地行を更新
- 残枚数報告義務 (2026-07-09): 「出荷済 X / 2074 = 残 Y printings」を session 開始時 + 出荷ごと

## 統合 M-plan (2026-07-10 ユーザー承認「いくつかでまとめて」— S3〜S15 を 5-7 session に圧縮)

| M | 旧行 | 中身 | unit≈ |
|---|---|---|---|
| ✅M1 | S3+S12 | mega-sweep: re-triage 機械分類 → easy 刈り — **実績 28 unit = 34 printings (1796→1830、残 244)**。134 unit 全 triage = GREEN 33 / SMALL_GAP 47 / BLOCKED 54 ([triage-m1-2026-07-10.md](triage-m1-2026-07-10.md))。case 群 S8 分 6 printings 先食い。BUG-181/182 起票 (resolver、M5 で修正)。Track B re-mine は次回繰越 (gen-simple-cards は --dry 非対応・出荷済上書きに注意) | ~30 |
| M2 | S4+S7+S8 | **attribution mini-wave 先行** (設計 spec 済: [miniwave-attribution-2026-07-10.md](miniwave-attribution-2026-07-10.md)、byPlayer 1-field + costPaid 4 case + costRevealedMatches で 12 unit) → T2 cluster batch: set-card + dyn/counter + cutin-filter 残 (cluster 単位 1 lens) | ~23 |
| M3 | S5+S11 | UI mega: PA batch + B09027 cost-choice — UI 2 型を Playwright 1 pass に同居 (溢れたら分割) | ~15 |
| M4 | S6+S9 | intercept + attribution + 大物 A | ~13 |
| M5 | S10+D06013 | 大物 B + stacked-identity + D06013 (resolver 触る回を 1 つに集約) | ~10 |
| M6 | S13-15 | buffer: 持ち越し / bug 回収 / 最終 audit | — |

前提 token 削減施策 (2026-07-10 出荷): ①rules 自動注入停止 (claudeMdExcludes) ②`npm run ground`
(grounding 決定論前処理) ③specs/grounding/ 永続化 ④gen:probes cost-gate/and-condition 拡張
⑤haiku 機械 lens + T0-T2 1 lens + resumeFromRunId ⑥locate = Serena/cavecrew 委譲。
