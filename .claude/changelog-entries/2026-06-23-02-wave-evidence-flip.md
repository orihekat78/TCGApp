# engine拡張 wave — evidence-flip-faceup 有効化 (証拠を表向きにする 5枚)

**Round/Phase**: 2026-06-23 カード追加 wave#2 (A 継続、engine 拡張クラスタ)。triggered-draw wave (同日 -01) の後続。
残 unimplemented (671) を実テキストで密度検証 → engine 不触 clean は薄く散在 (残弾枯渇)、最密 yield は
**evidence-flip** 族と判明。`evidenceFlip` atom は engine に存在するが **idx 固定形のみ = 実カード文言で使えない
死 atom** (shipped 0) だった。ユーザー裁定で **engine 拡張クラスタ** を選択し、additive に有効化。

## engine 拡張 (additive、回帰ゼロ: 使用カード0)

`evidenceFlip` を「(相手の)証拠を表向きにする」effect として使えるよう 3 挙動を additive 追加 (4 files):

- `src/engine/effect/atom-handlers/core.ts` `atomEvidenceFlip`: ① 旧 `{player,idx}` 固定形 = 後方互換維持
  (atom-handlers.test.ts) / ② `fromTop:true` = 「上から1つ表向き」(末尾 index、deterministic・必須、選択なし) /
  ③ pick-form = 「(相手の)裏向きの証拠を1つまで選び表向き」(chooser=controller、candidate side=証拠 owner、
  faceDown 限定)。evidenceToHand fromTop / 短縮形 PB pick と同型。
- `src/engine/effect/atom-pick-spec.ts`: `ATOM_PICK_SPEC.evidenceFlip = {defaultArea:'evidence', mode:'PB'}` +
  `buildShortFormPick` で `faceDown` を query へ pass-through。
- `src/engine/target/candidates.ts` evidence case: `query.faceDown===true` で表向き証拠を候補除外。
- `src/engine/types/effect.ts`: `TargetQuery.faceDown?: boolean` 追加 (TargetFilter でなく Query 直下 = sync test 対象外)。

回帰ゼロ証跡: evidenceFlip 使用カード従来0 / legacy idx test pass / sync-taskA-whitelists pass /
smoke winsA=498 baseline 不変 (新5枚は MVP デッキ外)。

## 追加カード (5、ALL_CARDS 1378 → 1383、touched=各1)

- **B07064 ワトソン** (白3/鷹): 【登場時】相手の裏向き証拠1つまで選び表向き (enter selfOnly + evidenceFlip pick)。
- **B03076 世良真純** (赤4/探偵): 【登場時】相手の証拠を上から1つ表向き (evidenceFlip fromTop) + ヒラメキ draw。
- **B08085 シェリー** (黒2/黒ずくめ): 【事件青＆黒】【相手ターン中】【現場リムーブ時】相手の裏向き証拠1つまで表向き
  (leave selfOnly + and[caseColor青&黒, turn opp] + evidenceFlip pick) + カットイン【自分ターン中】AP+2000。
- **B09076 / B09076P 三池苗子** (黄2/警察): 【疾風】相手の裏向き証拠1つまで表向き (enter selfOnly + enterOrderEquals1 +
  evidenceFlip pick) + カットイン【自分ターン中】AP+2000。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-evidence-flip-2026-06-23.test.ts、20件): candidates() で faceDown filter +
  side='opp' 解決を face-up証拠/自証拠 decoy で witness / runAtom で fromTop(上から=末尾)・pick-resolved を
  bottom/自証拠 decoy で witness / leave caseColor・turn・疾風 enterOrder の gate を decoy で 1対1 / legacy idx 後方互換 /
  end-to-end (enter emit→runAllUntilEmpty→drainAiEffectPicks) で「裏向きの相手証拠のみ表向き化」確認。
- **敵対 faithfulness review** (opus workflow、5カード + engine 拡張 lens): 全 faithful (blocker 0)。
- typecheck 0 (両config) / vitest 2802→2822 (+20 新 test、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip。
