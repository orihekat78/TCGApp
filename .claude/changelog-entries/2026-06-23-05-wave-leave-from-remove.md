# wave — leave-from-remove (現場リムーブ時→リムーブエリアから登場/手札 10枚、engine変更0)

**Round/Phase**: 2026-06-23 カード追加 wave#5 (A 継続)。A2「engine投資」選択を受け leave-trigger クラスタ
(棚卸 57) を grounding 精査。機械分類 + exemplar 突合の結果、棚卸の「leave-trigger=【現場リムーブ時】hook 一般化が最難」は
**誤** と判明 — hook (leave:to-remove) は 30枚超 subscribe の成熟済 path。最大 clean slice **group B
(self-leave→リムーブエリアから pick→登場/手札)** は B03113 シェリーが verbatim exemplar で **engine変更ゼロ**。
真の engine 一般化が要る観測者型 (D/F/A 群) とは別物。ユーザー確認の上、最大 clean yield の group B を出荷。

## engine変更ゼロ (touched: src/cards のみ、src/engine 0 file)

既存 settled path の再録のみ:
- `leave:to-remove` selfOnly trigger + `condition{turn:opp}` (B03113 a1 / B04059 a2)
- `sceneEnter{from:'remove', viaEffect, enterSleep, filter}` short-form (B02038 a2、atom-pick-spec.ts:60 既存)
- `handAddFromRemove{filter}` (B03005 a2)
- `condition{and:[partnerColor, turn]}` (B03067 a1)、continuous `bond` + `grantKeywords` (B08010 a1)、hirameki sleep (D01012 a2)

回帰ゼロ証跡: src/engine diff 0 / smoke winsA=498 baseline 不変 (新10枚は MVP デッキ外) / vitest 2868→2881 (+13)。

## 追加カード (10、ALL_CARDS 1395 → 1405、touched=各1)

- **B02075 / B02075P 諸伏高明** (黄7/警察・長野県警): 【相手ターン中】【現場リムーブ時】リムーブの 長野県警 Lv≤6 を1枚まで sleep登場。
- **B02066 / B02066P メアリー** (赤6/赤井家): a1【登場時】draw1+discard1 / a2【相手ターン中】【現場リムーブ時】リムーブの〚メアリー〛Lv≤5 を1枚まで sleep登場。
- **B05091 / B05091P 風見裕也** (黄7/警察・警視庁・公安): a1【絆降谷零】〚突撃[キャラ]〛(continuous) / a2【相手ターン中】【現場リムーブ時】リムーブの〚降谷零〛Lv≤6 を1枚まで sleep登場 / a3【ヒラメキ】キャラ1枚まで sleep。
- **B05099 / B05099P 高木渉** (黄5/警察・警視庁): 【パートナー黄】【相手ターン中】【現場リムーブ時】リムーブの 警察 Lv≤4 を1枚まで sleep登場 (and[partnerColor黄, turn opp])。
- **B05058 富沢雄三** (白5/絵描き): a2【相手ターン中】【現場リムーブ時】リムーブの 鈴木財閥 を1枚まで手札へ (handAddFromRemove)。**a1 DEFER** (継続 self-trait 付与=engine gap)。
- **B05116 火傷の男** (黒6): a2【相手ターン中】【現場リムーブ時】リムーブの【黒】Lv≤4 を1枚まで sleep登場。**a1 DEFER** (forced-target=engine gap)。

B05058/B05116 は **partial-ship** (継続 passive a1 を DEFER + a2 leave 出荷)。先例 ct-p04/B04059 (a1 動的名前付与 DEFER + a2 出荷) と同型。

## DEFER

- **B05111 ゾンビ (全体)**: a1 leave→〚ウォッカ〛登場 は clean だが a2「【ヒラメキ】【解決編】**アクション中のキャラ**を1枚まで選びスタン」=
  ヒラメキ解決時に actor を指す binding が engine 不在 (evidence:remove-by-action ctx に attacker uid 不在)。汎用 pick だと over-fire=不誠実ゆえ全体 DEFER (DEFERRED-INDEX)。
- **B05058 a1 / B05116 a1**: 上記 partial-ship の継続 passive (trait-grant / forced-target)。各 engine gap (DEFERRED-INDEX)。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-leave-from-remove-2026-06-23.test.ts、13件): 各カード behavioral
  (positive 登場/手札 witness + level/trait/cardName/color decoy 除外 + 自身 remove 移動後の自己再登場 level 除外)、
  turn:opp gate (自分ターン無発火)、partnerColor黄 gate (非黄無発火)、二次節 (enter draw+discard / 絆 continuous keyword /
  ヒラメキ sleep) 構造同型、parallel 同一性、DEFER 節の abilities 数断言。
- **敵対 faithfulness review** (opus workflow、6カード lens + engine-0 lens): faithful / blocker 0。
- typecheck 0 (両config) / vitest 2868→2881 (+13、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 124 / 規約 lint 8本 errors=0。
