# wave decklook-enter-handadd — 【登場時】deck-look→hand-add 7枚 (engine変更0)

**Round/Phase**: 2026-06-23 カード追加 wave#8 (A 継続、engine変更0)。【登場時】に自分のデッキ上を見て条件カードを
1枚まで手札に加え、残りをリムーブ(or デッキ下+シャッフル)する deck-look クラスタ。exemplar = B07035 a1 /
B06010 a1 の純既存パターン流用。

## 追加カード (7、ALL_CARDS 1410 → 1417、touched: 新規7 + 既存event 2 backfill)

- **B05016 / B05016P 小嶋元太** (青6/少年探偵団): 【登場時】reveal3 upTo 特徴[少年探偵団]キャラ → 手札 → 残りリムーブ。
- **B09079 佐藤美和子** (黄4): 【登場時】reveal3 upTo カード名[高木渉] (kind 制約なし) → 手札 → 残りリムーブ。
- **B06048 / B06048P 峰さやか** (白4/YAIBA): 【登場時】reveal3 upTo 特徴[YAIBA]カード(キャラ/イベント問わず) → 手札 →
  残りリムーブ → 加えた&解決編なら手札1枚リムーブ (tail conditional and[bound,caseStatus解決編]→discard)。
- **B06053 / B06053P 鉄刃** (白6/YAIBA): 【登場時】reveal-until 特徴[YAIBA]イベント → 手札 → 残りデッキ下 → シャッフル。

DSL は既存 verb のみ (deckRevealUntil{chooseMatch:'upTo'|until, filter} / handAddFromDeck / boundToRemove /
deckToBottomBound / deckShuffle / conditional / and / caseStatus / discard)。filter honor (trait/cardName/kind) は
src/engine/effect/atom-handlers/_shared.ts targetFilterToPredicate を実コードで裏取り (capability-map の
「deckReveal で filter drop」記述は BUG-117/118 以降 stale)。

## YAIBA event trait データ補完 (engine変更0、先例 ef29f608)

B06048「特徴[YAIBA]のカード」/ B06053「特徴[YAIBA]のイベント」はイベントも対象だが、event.tsv に features 列が
無く実装済 YAIBA イベント (B06035 風神剣 / B06033 わが味方) は従来 traits:[] で **永久非マッチ** (silent no-op)
だった。公式 API (_raw/ct-p06-api.json) category1=YAIBA を正本に **B06035 / B06033 の traits に YAIBA を per-card 補完**
(B06033P は spread で継承)。これで B06053 の match 経路と B06048 の event 枝が live 化。
> 先例: ef29f608「赤魔術 trait データ補完」(B07055/B07058 等)。**known-gap (systemic)**: event/case の TSV
> category-drop は全パッケージに及ぶ。未実装 YAIBA イベント (B06034/B06062/B06063/B06064) も将来 impl 時に
> traits:['YAIBA'] 明示が必要。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-decklook-enter-handadd-2026-06-23.test.ts、14件): filter 各軸の 1対1 witness
  (B05016=trait少年探偵団+kind:character / B09079=cardName高木渉 / B06048=trait YAIBA 無kind + 解決編 tail discard の
  4分岐 [事件編/解決編×match/no-match] + event枝 B06035 / B06053=reveal-until + YAIBA char は kind:event 非該当でデッキ下 +
  no-match 全残置) + backfill regression (B06035/B06033/B06033P traits YAIBA) + 全 descriptor 構造 + P=base 等価。
- **敵対 faithfulness review** (opus): v1 5-lens で **1 BLOCKER** (B06053 DEFER 誤判定 — 真因は event-trait データ欠落で
  ef29f608 が engine変更0 解消法を確立済) + **1 CONCERN** (B06048 event 枝の未追跡) を検出 → 両者を backfill+出荷+
  event-witness test で解消。v2 2-lens 再 review で delta を再検証。
- typecheck 0 (両config) / **engine diff = 空 (engine変更0 確証)** / vitest 2896→2910 (+14、baseline 不変) /
  smoke winsA=498 exc0 baselineOK (非MVP=baseline完全不変) / e2e 98pass+1skip (99、e2e spec ファイル不変ゆえ main baseline と同値) / pre-commit。
