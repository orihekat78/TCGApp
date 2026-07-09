## engine defer-unlock mini-wave — additive 8 primitive + BUG-177 + 16 printings (2026-07-09)

hybrid-pilot/batch2 の engine-gap DEFER を一括解禁する additive mini-wave。

**Engine (8 primitive、全 additive・既存挙動不変)**:

1. cond `contactCharMatches{who:'byUid'|'targetUid', filter}` — コンタクト参加キャラの TargetFilter 評価。ctx.contact 優先 + ctx.bindings.contact[0] fallback (triggered matcherCondition の queue-time gate 対応 = 【ターン1】保全、rules/24)
2. `mill` に `bind` writeback (「これによって〜がリムーブされた場合」、discard 同型)
3. `removeAreaToDeckTop` に `dest:'bottom'` + 0枚→chainStepNoApply gate
4. `charOverrideAP` に `scope:'turn'` (turnEffects['apOverride_turn']、rules/19 QA: 修整は残る)
5. `removeAreaAllToDeckBottom` に `player` param (省略時は従来の両者対称)
6. TRIGGERED_HOOKS に `phase:main:start` (「メインフェイズ開始時」、emit は既存)
7. Cost `partnerAreaRemove` (PA 一般カード枠 n 枚リムーブ、B07039 宣言 cost)
8. dyn `$self.partnerAreaTraitCount.<trait>` (PA の特徴計数、removeNameCount 同式)

**BUG-177 (高)**: 「〜のキャラに【カットイン】した/する場合」の判定方向が公式Q&A (B02006:
「コンタクト中の**自分の**キャラが〜の場合」) と逆 (コンタクト相手を参照) だった。
`_shared/contactTargetMatches` を contactCharMatches{who:'byUid'} 委譲に書換え、経由消費者 11 枚
(B04025/B04060/B06041/B06092/B06101/B07009/B07050/B08071/B08086/D10011/PR087) + D11013 inline +
PR287 spread = 13 printings を一括修正。旧方向を pin していた test 3 file を公式Q&A 準拠に書換。

**Cards (16 printings)**: B02006 仮面ヤイバー / B02080 三池苗子 / B02076 大和敢助 (+PR133) /
B04038 白馬探 (+PR027/PR031) / B05072 沖矢昴 / B07039 アン王女 / B07046 ドロン刑事 /
PR132 諸伏景光 (+PR213/PR285) / PR201 鈴木次郎吉 (+PR207) / PR278 萩原千速 (D11013 spread)。
B05022 は charOverrideAP scope:'turn' 出荷済も multi-pick carrier gap で card DEFER 継続。

**検証**: probe 27 (engine) + 24 (cards manual) + 5 (gen:probes)。tsc 0 / vitest 4382+1skip (回帰0) /
crosscheck 14/14 / smoke:1000 winsA=472 不変 exceptions=0 / 8 lint err0 / 混成 2-lens review。
