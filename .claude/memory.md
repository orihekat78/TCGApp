# memory — 現セッション scratchpad

## セッション54 (2026-06-23) — wave reveal-handadd (engine変更0、出荷10、cards/wave-reveal-handadd)

ユーザー選択: A「カード追加 継続」。reveal/deck-look→hand-add family を選定・実装。

**手法 (CLAUDE.md 決定論優先を徹底)**: 棚卸 signature tag は不可信を再実証 (col11/12 由来で col10 effect と無関係、
clean プールも hidden gate 混在)。**engine capability を agent 前にスクリプト grep で確定**:
- deckRevealUntil.filter = targetFilterToPredicate → defHasKeyword で keyword 印字判定 (変装=icon-disguise / 疾風=enterOrderEquals) + filterAny(OR) 対応
- sceneEnter source ∈ {hand,remove,deck} + filter (D07008/B01076) / mill は静的count (動的=DEFER) / caseTraitConditioned(continuous grantKeywords) で 【事件特徴】〚突撃〛
→ NEXT-SESSION の DEFER フラグ (B02050 keyword-filter / D10003 突撃+caseTrait) が **保守的すぎ=実装可** と判明 (capability-map stale 同型教訓)。

**ワークフロー**: ①author+verify (6 spec、opus pipeline) → 全 faithful+engineZero。②出荷ファイル直接の最終敵対review (6 lens)。

**出荷 10** (ALL_CARDS 1430→1440、engine変更0、手書き):
B02050 中森銀三 (reveal-until keyword変装) / B05114 弁崎桐平 (declared selfToDeckBottom cost + reveal-until cardNameバーボン) /
B05082+P 「FBI…」(event-use: reveal5 FBI→hand→remove→sceneEnter from hand) / B07010 円谷光彦 (reveal2 少年探偵団 + 解決編&加えた discard / 宣言 AP+3000) /
B09074+P+P2 松田陣平 (疾風 draw + reveal4 keyword疾風 + 加えた discard) / D10003+D10004 黒衣の騎士・スペイド (caseTrait突撃 + reveal-until cardName)。

**敵対 review が実バグ1件検出 (gate の真価)**: D10003/D10004 a1 inner.description が prefix 込み →
caseTraitConditioned 再付与で **二重prefix** (表示のみ)。inner.description から prefix 削除 (B07047/B07052 慣行) +
rules/24 追加 + 回帰防止 assertion で close。他 NIT は全非問題。

**検証 (全green)**: tsc0両 / vitest 2951→2969 (+18 decoy test) / smoke winsA=498 exc0 baselineOK (engine diff空が確証) /
e2e 123pass+1skip / 規約lint8本 errors0。decoy test = keyword[変装/疾風] は実能力持ち(D06012/D11003) match・stub decoy 非該当、
no-match over-fire guard、解決編/事件編 discard 分岐、caseTrait gate (read.char.keywords)、P版同一性。

**DEFER 据え置き**: PR265 (mill 動的count) / B09078 (dual-pick from one window) / B08026・B03028 (event-use closure/hook) / B04063 (動的level-sum)。

記録: changelog-entries/2026-06-23-10 / 教訓=NEXT-SESSION/capability-map の DEFER・⛔negative は engine 直grep で裏取り (stale 化しうる)。
