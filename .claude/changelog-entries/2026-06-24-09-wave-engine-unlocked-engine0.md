# cards — wave engine-unlocked-0624 (a206e9dc 解放分の出荷、engine変更0)

**Round/Phase**: 2026-06-24 カード追加 wave (engine変更0)。engine additive wave **a206e9dc**
(ContinuousModifier.lvlDelta + Cost stunChar) と carrier-reuse stale 訂正で解放された 4 DEFER を
card-session が clause 単位で精査 → faithful な 2 枚 (×parallel = 4 cards) のみ出荷、残 2 枚は
**第2 engine gap** を発見し再 DEFER。

## 出荷 (REUSE_CARDS +4、engine変更0)

| rep | カード | 句マッピング |
|-----|--------|-------------|
| B08023 / B08023P | 大岡紅葉 (緑 char R/RP) | 【登場時】choice×3 **短縮形** carrier-reuse: ① 伊織無我1枚まで→自deck裏向きセット+ターン終了時まで AP+2000 / ② 同→突撃付与 / ③ 相手現場キャラ1枚まで→相手deck裏向きセット(charSetCard{player:'opp'}=B02020/B05028 同型)+スリープ。「1枚まで」=0可で bind 未解決→silent no-op。⚠ 明示 uid:'$pick'+target 形は human 経路で rider 不発 ([BUG-158](../bugs/BUG-158.md)) のため **短縮形必須** |
| B08050 / B08050P | 宮野明美 (赤 char R/RP) | a1=【解決編】lvlDelta+3 (continuous, condition=caseStatus解決編、自己参照なし。read.char.level のみ反映 / play-level 静的=QA「現場以外はLv4」) / a2=【登場時】deckRevealUntil(upTo,maxN:3,filter無=任意)→handAdd→**boundToRemove→discard** 順 + conditional{boundMatchesFilter cardNameNot:[諸星大/宮野志保/宮野エレーナ/宮野厚司]}。boundMatchesFilter は bound空(0枚add)で false=「加えた場合」gate を内包 |

- B08004 errata 2026-03-02「現場にいる」追記は B08004 が DEFER のため未出荷 (下記)。

## 敵対 review で検出した BLOCKER 2件 (出荷前に修正済)

opus 4-lens 敵対 review (うち defer-soundness lens と B08050-fidelity lens が empirical probe で検出):

1. **B08023 carrier human 経路 no-op → [BUG-158](../bugs/BUG-158.md)**: 初版は exemplar B02040 を踏襲し明示
   `uid:'$pick'+target` 形で書いたが、これは **human 経路で bind 喪失** → rider (AP/突撃/sleep) が silent
   no-op (実機: AP=3000、AI 経路のみ 5000)。**短縮形** carrier へ変換して修正。出荷済 B02040/P・B02046/P・PR049
   も同形で該当 → BUG-158 に水平展開記録 (別 session で短縮形変換 or engine 統一修正)。
2. **B08050 step 順序**: 初版は handAdd→discard→boundToRemove だったが、deck≤3 で boundToRemove の
   リフレッシュが discard 済み札を deck へ巻き戻す。公式テキスト順 **handAdd→boundToRemove→discard** に修正
   (deck=3 回帰 test で discard 札が remove に残ることを pin)。

> 2 lens (B08023-fidelity / dsl-trap) は「B02040 と同形ゆえ CLEAN」と **誤判定** (human 経路を実測せず)。
> empirical probe を回した lens のみ正答 → carrier-reuse は **human 経路実測** が必須 (BUG-158 防止策)。

## 再 DEFER (engine wave の over-claim 訂正)

| rep | 第2 engine gap (出荷不可の理由) |
|-----|------------------------------|
| **B08059 / B08059P** 諸星大 | 「現場にレベル7のキャラ2枚以上」が **このキャラ自身(lv6+1=7)を含める latch** (公式QA「このキャラを含め2枚」)。`_inContinuousDelta` guard (candidates.ts:24) が depth-2 で全 delta を base 化 → 自己条件評価中 諸星=6。**engine 実測**: 諸星+他lv7×1 で read.char.level=6 (QA要求7)。lvlDelta 機構は a206e9dc で追加済だが self-counting 条件は未対応 → recursion guard の自己 delta 例外 (要 engine 変更) |
| **B08004 / B08004P** 江戸川コナン | stunChar コスト自体は a206e9dc で表現可。だが宣言ゲート「リムーブエリアに【黒】の**キャラ**3枚以上」は remove-area を **色AND種別(character)** で数える必要があり、removeColorAtLeast (cond/eval.ts:192) は色のみ (黒イベント誤計上) → remove-area の kind 付き count 条件が未対応 (要 engine 変更、additive) |

- engine wave の敵対 review は lvlDelta の「無限ループ無し」のみ検証し、B08059 の QA self-counting fidelity を見落としていた (本 wave が empirical test で surfacing)。

## 検証 (engine変更0 ゲート)

- **engine変更0 証跡**: `git diff src/engine` 空。
- `tsc` 0 / `vitest` 3091 pass +1 skip (本 wave +12 behavioral+structural) / 0 fail。
- `smoke:1000` winsA=498 / avg=10.998 / timeouts=exceptions=0、baseline OK (engine変更0 機械保証)。
- 8 lint + eslint errors=0。
- opus 4-lens 敵対 review (fidelity B08023 / fidelity B08050 / DSL-trap+engine0 / DEFER-soundness)。

## テスト (wave-engine-unlocked-0624.test.ts、12 件)

- structural: 4枚登録 + B08023 choice×3 carrier bind / B08050 lvlDelta+deck-look 構造 + parallel 共有。
- behavioral: B08023 opt1/2/3 carrier-reuse 実 mutation + 0-pick no-op / B08050 解決編Lv7・事件編Lv4 +
  deck-look (in-set 保持=net+1 / not-in-set=discard=net0 / rest→remove)。
