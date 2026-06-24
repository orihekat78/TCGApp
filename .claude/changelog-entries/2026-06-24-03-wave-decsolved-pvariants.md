# cards — wave decsolved-pvariants: ベルモット B06100/B06100P 出荷 (engine変更0)

**Round/Phase**: 2026-06-24 cards/wave-decsolved-pvariants。消失した「12〜15枚 wave」候補
(B01099P–B01102P / B04038 / PR027 / PR031 / D07017 / PR023 / D09023 / D09009 / PR177 / B06100+P / PR241)
を full-text grounding で再棚卸した結果、**真の新規は B06100/B06100P の2枚のみ**と判明。

## 棚卸結果

- **既出荷 10枚** (B01099P–B01102P / D07017 / PR023 / D09023 / D09009 / PR177 / PR241): catalog-reuse
  batch で既に commit + REUSE_CARDS 登録済。codegen は existsSync skip。本 wave で再実装せず、
  敵対 verify の bonus QA 対象に回し **全件 faithful 確認**。
- **engine-gate 3枚 DEFER** (B04038 / PR027 / PR031 白馬探): 【登場時】「**自分の**リムーブエリア全部→
  デッキ下+シャッフル」の self-only drain verb が engine 不在 (`removeAreaAllToDeckBottom` は両プレイヤー
  固定)。DEFERRED-INDEX に追記。
- **新規 2枚** B06100/B06100P (ベルモット, 黒 lv4/3000/1)。

## 実装 (B06100/B06100P)

> 【登場時】手札から【カットイン】を持つ【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。

- a1: triggered enter → `chain[ discard(self, max:1, filter{keyword:カットイン, color:黒}), draw(self, n:2) ]`。
- 「カード」= 種別非限定 → filter に kind なし (正)。「してもよい」= max:1 (0可)。「そうした場合」= chain semantics
  (step1 が実リムーブした時のみ step2 draw)。filter.keyword は defHasKeyword で ability 構造判定 (BUG-122 回避)。
- taskA-codegen path: validate-specs(engine変更0) → 敵対 verify(faithful, high) → codegen --write → register。

## 検証 (全 green)

validate-specs pass=2 / tsc0 / eslint0 / vitest **3000 pass 1skip 0fail** / smoke:1000 **winsA=498 baseline OK**
(engine変更0 証跡) / 敵対 faithfulness verify 9 verdict (B06100 含む8件 faithful)。

## 派生発見 → BUG-155

敵対 verify で **PR241 (既出荷, PR235 spread)** が mismatch (MAJOR, latent): discard filter が公式の
「キャラ」種別明示に対し `kind:'character'` 欠落。実害なし (赤×〚赤井家〛イベント 0件) だが faithfulness gap。
**完全 sweep は parser ベースが必須** (grep は複数行 filter を取りこぼす) のため BUG-155 起票・本 wave 不修正。
