# engine: MR partner-area cohort yield 表 (2026-06-23 grounding, 敵対review反映 v2)

[engine-mr-partner-area-design.md](engine-mr-partner-area-design.md) の companion。残 MR 25 unique の歩留まり。
出典: 各 card full-text + rules/18 + DEFERRED-INDEX + live engine 突合 (opus grounding + 3-lens 敵対review)。

## 検算 (universe → 25 unique)

cards-data rarity^=MR = **30 unique num** (B05005 B05027 B05045 **B05066** B05086 B05106 B06003 B06037 B06066 B06074 B06084 B06098 B07001 B07015 B07030 B07065 **B07079** **B07093** B08002 B08019 **B08032** B08046 B08062 B08093 B09002 B09070 B09108 B09109 **B09110** **B09054**)。
うち **既出荷 (PA 句 vacuous) 5件 = B05066/B07079/B07093/B08032/B09054** を除外 → 残 **25 unique** (parallels 込 53 printings、MR/MRP/MRCP)。

## SOLE-blocked = 15 (PA-slot + read/char PA-MR 走査だけで到達 → card wave 対象)

| num | title | 主効果 (要点) |
|-----|-------|--------------|
| B05027 | 服部平次＆遠山和葉 | 宣言 活性 or 突撃付与 / 登場時 sleep。DEFERRED L286 が MR 単独 gate 明記 |
| B05086 | 安室透＆降谷零 | 黄アクション時 remove / 黄 AP+1000 |
| B05106 | ジン＆ウォッカ | 相手リムーブ時 remove (leave-observer) / 宣言 自己犠牲 chain。DEFERRED L65 |
| B06003 | 毛利蘭＆江戸川コナン | 突撃 / 宣言 LP-2 / draw+handAtLeast5 conditional discard |
| B06037 | 服部平次＆沖田総司 | 高校生登場時 remove / removeFromHand cost+actionTargetsActive |
| B06066 | 怪盗キッド＆白馬探 | 宣言 sleep cost→deck下 / phase-end sleep+stun≥3 で活性 (count cond は wave 時要再確認) |
| B06084 | 安室透＆榎本梓 | 登場時 公開(no-op)+remove / draw+捜査1+条件discard |
| B06098 | ベルモット＆シェリー | remove+黒ずくめ trait-count / deck3見てカットイン黒手札 (keyword filter supported) |
| B07001 | 毛利蘭＆灰原哀 | deck3 remove cost→trait別 AP+突撃 / 青 LP-1+actionTargetsActive |
| B07015 | 遠山和葉＆大岡紅葉 | sleep cost→緑イベント使用 / 登場時 deckRevealUntil 緑イベント手札 |
| B07065 | 世良真純＆メアリー | removeFromHand cost→remove / draw+handAtMost2。split-name supported |
| B08002 | 江戸川コナン＆灰原哀 | remove+level分 mill / リムーブ少年探偵団を青の下に重ねる (charStackCard remove源) |
| B08019 | 大岡紅葉＆伊織無我 | 登場時 remove / 自他 set card 各1除去→draw |
| B08046 | 赤井秀一＆ジョディ | remove+FBI trait-count / 手札FBI cost→draw+追加draw |
| B08062 | 佐藤美和子＆高木渉 | 登場時 remove / 全員佐藤高木なら AP+1000 aura。**条件付き SOLE**: aura は「PA でも有効」→ read/char.ts auraDelta が PA-MR 走査する前提 (design 変更#6)。未拡張なら MULTI |

(SOLE は planning 見積。各カードの二次節は wave 着手時に per-card full-text 再 grounding で最終 gating。)

## MULTI-gate = 10 (PA-slot に **加えて** 別 engine gate 要 → 各 gate 解禁後)

| num | title | 追加 gate |
|-----|-------|----------|
| B05005 | 江戸川コナン＆工藤新一 | **mustGuard 未強制** (token set のみ、guard.ts は ブレット/sleepGuard のみ読む。char.ts:155 cleanup 単独)。Task D mustGuard gate |
| B05045 | 怪盗キッド＆黒羽快斗 | hand→FILE 最下段 face-up 移動 verb 不在 (fileAdd は deck-top 専用) |
| B06074 | 沖矢昴＆世良真純 | a2: fileAtMost cond 不在 (eval.ts:70 fileAtLeast のみ) + ターン終了時 delayed-effect 不在 |
| B07030 | 黒羽快斗＆中森青子 | PA 常駐 **非MR**(ビッグジュエル イベント) カード枠 + remove→PA verb + PA trait-card cost |
| B08093 | 灰原哀＆シェリー | hand-reveal-as-COST kind 不在 (Cost union に revealFromHand 無) |
| B09002 | 工藤新一&毛利蘭 | **hand-reveal-as-gate** 不在 (「工藤/蘭を公開してもよい。そうした場合活性」= handHas{filter} cond + 手札残す reveal、B08093/B09109 同族) |
| B09070 | 萩原千速&萩原研二 | 「このターン疾風を発動したキャラ」per-char fired-keyword turn 追跡 flag 不在 |
| B09108 | 工藤新一&服部平次 | name-designation condition + 宣言 UI surface 不在 (DEFERRED L85) |
| B09109 | 怪盗キッド&安室透 | hand-reveal-COST + card-name rewrite verb の2機構不在 |
| B09110 | 赤井秀一&ジン | **dynamic reveal filter** 不在 (deckRevealUntil が「リムーブキャラと同名」= 除去キャラ snapshot に bind した動的 cardName filter、split-name 展開要)。+ PA 自己 remove cost |

**二次 gate の共通性**: hand-reveal 系 (cost/gate) が B08093/B09002/B09109 の **3枚**に跨る → PA-slot の次に検討価値高い小 cluster。fileAtMost (B06074) は handAtMost (eval.ts:131) の鏡像で additive 容易。

## ⚠ STALE negative 訂正 (grounding が live code で発見、要 capability-map/DEFERRED 修正)

- **keyword filter** (カットイン/変装/ヒラメキ/現場リムーブ時/疾風) は BUG-122+cluster2 で supported ([_shared.ts:72](../../src/engine/effect/atom-handlers/_shared.ts)/[keyword.ts:75](../../src/engine/read/keyword.ts))。「cutin filter 不一致」STALE → B06098 解放。
- **他キャラ AP/LP aura** は cluster13 ([read/char.ts:56](../../src/engine/read/char.ts) auraDelta) で解禁 (ただし scene 走査のみ=B08062 は PA 走査拡張要)。「continuous owner-only」STALE。
- **split-name** (rules/19) tsv-loader 実装済。DEFERRED L519「B07065 split-name hard gap」STALE → 解放。
- **handAtMost/handAtLeast** condition 実在 ([cond/eval.ts:127](../../src/engine/cond/eval.ts))。B06003/B07065 解放。

→ [[reference-capability-map-stale-negatives]] 再実証。⛔ negative は live code 直 grep で裏取り必須。
