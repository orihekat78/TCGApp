# BUG-153 修正 (charSetCard host-check) + B05035 解禁 (engine additive)

**Round/Phase**: 2026-06-23 カード追加 wave#7 (A 継続、engine additive 小 wave)。セッション㊿ で敵対 review が
検出・起票した **BUG-153** (charSetCard{fromDeckTop} の host-absent カード消失バグ) を修正し、DEFER していた
B05035 遠山和葉 を再出荷。前 wave (codegen-handcount-setevent, 7eaacff0) の解禁条件を満たす後続。

## engine 拡張: additive 10 行 (BUG-153 修正)

`charSetCard{fromDeckTop}` は従来 `deck.shift()` → `mutate.char.setCard` の順で、`setCard` が host 不在時
no-op (mutate/char.ts findChar) のため host 離場時に shift した上端カードが deck/remove/setCards のどこにも
残らず **消失**していた (公式Q&A『離場時はデッキ上に戻す』違反)。

修正 ([atom-handlers/char.ts](../../src/engine/effect/atom-handlers/char.ts)): fromDeckTop explicit-uid 分岐で
`sscDeck.shift()` の前に `readScene.byUid(s, scUid)` で host 存在を確認、不在なら shift せず return。

- `readScene.byUid` は `setCard` の `findChar` と **byte-identical** な scene scan (self.scene+opp.scene のみ)
  ゆえ host 存在時は従来と完全同挙動 = **回帰ゼロ**。
- diff = char.ts に 10 行追加のみ (1 import + host-check ブロック、既存行の変更なし)。
- 影響範囲は `charSetCard{fromDeckTop}` 使用の **約30カード** (当初 BUG-153 リスト 9枚は過少申告)。
  host≠`$self` (B03034 $contact / B07058・B09038 $entered / PR049 $pick / B02020・B03032 opp PA短縮形) が
  host-absent の真の到達経路で、全ケース faithfulness 改善方向 (deck 上端保持)・回帰なし。

## 追加カード (1、ALL_CARDS 1409 → 1410、touched=1)

- **B05035 遠山和葉** (緑5/高校生): 【登場時】デッキ上端1枚を公開 → 〚カード名[服部平次]/[遠山和葉]〛なら
  手札に加えてもよい → 加えなければ裏向きでこのキャラにセット。DSL は B01050 (reveal-1 + conditional add) +
  B02019 (chooseMatch:'upTo' decline channel) の合成 + B03061 set-facedown。
  `deckRevealUntil{maxN:1, cardName:['服部平次','遠山和葉'], chooseMatch:'upTo'}` → `if $matched handAddFromDeck`
  → `if $revealed charSetCard{fromDeckTop, faceUp:false, uid:'$self'}`。host-absent は BUG-153 修正で Q&A 準拠。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-bug153-setcard-host-check-2026-06-23.test.ts、8件):
  BUG-153 engine (host-absent=deck非消費 / host-present=回帰0 セット / empty-deck) +
  B05035 4経路 (服部平次→手札 / 遠山和葉→手札 / 工藤新一 decoy→裏向きセット+deck消費 / host-absent→deck上保持) +
  descriptor 構造 pin。
- **敵対 faithfulness review** (opus workflow、3 lens: B05035 faithfulness / BUG-153 engine correctness /
  水平展開 family impact): **3/3 PASS、0 BLOCKER**。1 concern (BUG-153.md 影響範囲が ~30枚へ過少申告) は本 wave で
  BUG-153.md を修正反映。
- typecheck 0 (両config) / vitest 2888→2896 (+8、baseline 不変) / smoke winsA=498 exc0 baselineOK
  (MVP デッキは charSetCard 不使用ゆえ新 branch 未到達 = baseline 完全不変が回帰0 証跡) /
  e2e 123pass+1skip / engine diff = char.ts 10行 additive のみ。
