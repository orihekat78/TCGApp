# wave — reveal-handadd (reveal/deck-look → 手札追加 family 10枚、engine変更0)

**Round/Phase**: 2026-06-23 カード追加 wave#11 (A 継続)。reveal/deck-look→hand-add family を grounding 精査。
棚卸 signature tag は不可信を再実証 — 「cutin」/「hirameki」tag は col11/12 由来で col10 effect と無関係、
clean プールも二次節に hidden gate (event-use closure / 動的count / dual-pick) 混在。
**engine capability を決定論 grep で確定** (エージェント前にスクリプト検証、CLAUDE.md 準拠): deckRevealUntil.filter は
targetFilterToPredicate→defHasKeyword で keyword 印字判定 (変装/疾風) + filterAny(OR)対応 / sceneEnter source∈{hand,remove,deck} /
caseTraitConditioned(continuous grantKeywords) / mill は静的count (動的=DEFER)。これにより
NEXT-SESSION の DEFER フラグ (B02050 keyword-filter gate / D10003 突撃+caseTrait) が **保守的すぎ = 実装可** と判明。

## engine変更ゼロ (touched: src/cards のみ、src/engine 0 file — git diff src/engine 空が確証)

既存 settled path の合成のみ:
- `deckRevealUntil` reveal-until [no maxN] (B06053) / deck-look [maxN+chooseMatch:upTo] (B05016/B02019)
- `conditional{bound $matched matched}` → `handAddFromDeck{$matched.cardId}`
- `deckToBottomBound` + `deckShuffle` (「残りをデッキ下→シャッフル」) / `boundToRemove` (「残りをリムーブ」)
- `sceneEnter {from:'hand', filter}` (手札から登場、D07008) / event-use trigger wrapper (B01076)
- `caseTraitConditioned(continuous grantKeywords['突撃'])` (【事件特徴】〚突撃〛、B07052/partnerColorKeyword)
- 疾風 = `trigger{hook:'enter', selfOnly, matcherCondition:enterOrderEquals(1)}` (D11003) / `charModifyAP{scope:'turn'}` (D11014) /
  `discard` の解決編&加えた guard = `conditional{and:[bound $matched, caseStatus:解決編]}`

回帰ゼロ証跡: src/engine diff 0 / smoke winsA=498 baseline 不変 (新10枚は MVP デッキ外) / vitest 2951→2969 (+18)。

## 追加カード (10、ALL_CARDS 1430 → 1440、touched=各1)

- **B02050 中森銀三** (白6): 【登場時】reveal-until【変装】を持つカード → 手札 / 残りデッキ下 + shuffle。filter keyword:変装 (印字判定、自身は対象外)。
- **B05114 弁崎桐平** (黒3): 【宣言】〚デッキの下に移す〛(cost selfToDeckBottom): reveal-until cardName[バーボン] → 手札 / 残りデッキ下 + shuffle。
- **B05082 / B05082P 「FBI…」** (赤6・event): reveal5 upTo 特徴[FBI]キャラ → 手札 / 残りリムーブ → 手札からレベル6以下[FBI]を登場 (sceneEnter from hand)。
- **B07010 円谷光彦** (青4): a1【登場時】reveal2 upTo 少年探偵団 → 手札 / 残りリムーブ + 【解決編】かつ加えた時のみ手札1リムーブ (over-fire guard) / a2【宣言】【スリープ】少年探偵団1枚まで AP+3000。
- **B09074 / B09074P / B09074P2 松田陣平** (黄4): a1【疾風】カード1枚引く / a2【登場時】reveal4 upTo 【疾風】を持つキャラ → 手札 / 残りデッキ下 + 加えた時のみ手札1リムーブ。
- **D10003 / D10004 黒衣の騎士・スペイド（工藤新一）** (青8): a1【事件シャッフルロマンス】〚突撃〛(continuous caseTrait gate) / a2【登場時】reveal-until cardName[シャッフルロマンス] → 手札 / 残りデッキ下 + shuffle。names 全分割 (rules/19)。

## DEFER なし

全10枚 ship-clean。NEXT-SESSION で DEFER 候補だった B02050 (keyword-filter gate) / D10003 (突撃+caseTrait) は
engine 直 grep で **stale フラグ** と判明 (defHasKeyword が変装/疾風 を印字判定、caseTraitConditioned が continuous keyword 対応) → full-ship。
同クラスタの真 gate (PR265 mill 動的count / B09078 dual-pick from one window / B08026・B03028 event-use closure/hook /
B04063 動的 level-sum) は DEFER 据え置き。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-reveal-handadd-2026-06-23.test.ts、18件): reveal→手札 positive、
  keyword[変装]/[疾風] は実能力持ち card (D06012/D11003) を match・stub decoy を非該当、cardName decoy 除外、
  全公開no-match (何も加えず全デッキ残)、boundToRemove (FBIキャラ→hand/decoy→remove・FBI event は kind 違反で remove)、
  sceneEnter from hand (FBI≤6登場)、解決編&加えた→discard / 事件編 no-discard / no-match over-fire guard、
  疾風 a1 draw、caseTrait突撃 gate (read.char.keywords)、P版同一性、複数名 names。
- **敵対 faithfulness review** (opus workflow、6 lens、出荷ファイル直接): 5/6 ship・blocker 0。
  **D10003/D10004 に WARN 1件検出** — caseTraitConditioned が 【事件X】 を再付与するのに inner.description が
  prefix 込みで **description 二重prefix** (`【事件シャッフルロマンス】【事件シャッフルロマンス】〚突撃〛`、表示のみ・挙動不変)。
  → inner.description から prefix 削除 (B07047/B07052 慣行) + rules/24 追加 + 二重prefix回帰防止 assertion 追加で close。
  他 NIT は全て非問題 (meta は TSV 確認済 / B05082+P は _reuse で登録済 ALL_CARDS1440 / bind↔bindKey は正常 / OneDrive hydration は環境)。
- typecheck 0 (両config) / vitest 2951→2969 (+18、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip (baseline 維持) / 規約 lint 8本 errors=0。

## 教訓 (capability の決定論裏取り)

NEXT-SESSION / capability-map の **DEFER/⛔ negative フラグは stale 化しうる** — エージェント grounding 前に
engine 実コード (effect/atom-handlers, cond/eval.ts, read/keyword.ts) を直 grep して capability を確定すべき。
本 wave は keyword filter / sceneEnter source / caseTrait continuous を全て engine 直確認し、保守的 DEFER 2件を解禁した。
