# engine拡張 wave — evidence-flip-facedown 有効化 (証拠を裏向きにする 4枚)

**Round/Phase**: 2026-06-23 カード追加 wave#3 (A 継続、engine 拡張クラスタ)。同日 evidence-flip-faceup wave (-02) の
**対称**。残 666 未実装を engine gate で棚卸 → facedown 「表向きの証拠を裏向きにする」が faceup と対称の最小 additive と判明
(真 clean yield 4枚)。faceup の `evidenceFlip` に対し、逆 mutate verb `evidenceFlipDown` を新設して解禁。

## engine 拡張 (additive、回帰ゼロ: 使用カード0、9 files)

新 verb `evidenceFlipDown`「自分の表向きの証拠を N つまで選び、裏向きにする」(evidenceFlip=表向き化 の逆):

- `src/engine/effect/atom-handlers/core.ts` `atomEvidenceFlipDown`: `atomHandAddFromRemove` 同型 3-path =
  ① `cardIds:'$pick.cardIds'` 未解決 (await→tryRePickFromAtom) / ② cardIds 配列 (resolved multi、各表向き証拠を
  1枚ずつ裏向き、同 cardId 複数も index-based で別個体を拾う) / ③ 単一 short-form (max:1、faceUp 候補限定)。
- `src/engine/mutate/evidence.ts` `flipFaceDown`: faceUp フラグのみ false 化 (配列位置不変 = B05013 Q&A「順番は変えない」)。
- `src/engine/target/candidates.ts` evidence case: `query.faceUp===true` で裏向き証拠を候補除外 (faceDown の逆)。
- `src/engine/types/effect.ts`: `TargetQuery.faceUp?: boolean` + AtomVerb union `evidenceFlipDown` /
  `atom-pick-spec.ts` ATOM_PICK_SPEC + buildShortFormPick faceUp / `validate.ts` ATOM_VERB_MAP /
  `scripts/taskA-validate-specs.cjs` VERBS (3点同期、sync-taskA-whitelists pass)。
- `src/engine/effect/resolve-picks.ts`: **CPU multi-pick 分岐に evidence kind 追加** — 従来 `c.kind==='card'`
  限定で evidence 候補を除外していた (human path は BUG-076 で対応済、CPU 側欠落)。B05013「2つまで」の CPU 解決に必要。
  既存 multi-pick (D08021 charStackCard=remove / B09034 handAddFromRemove=remove) は card kind ゆえ無影響 = 純 additive。

回帰ゼロ証跡: evidenceFlipDown 使用カード従来0 / evidenceFlip(faceup) 不変 (legacy 回帰 test) /
sync-taskA-whitelists pass / smoke winsA=498 baseline 不変 (新4枚は MVP デッキ外)。

## 追加カード (4、ALL_CARDS 1383 → 1387、touched=各1)

- **B05013 灰原哀** (青5/少年探偵団・科学者): 【登場時】自分の表向き証拠を2つまで選び裏向き
  (enter selfOnly + evidenceFlipDown multi-pick cardIds, n.max:2) + 【ヒラメキ】1つまで裏向き (short-form max:1)。
- **B06017 / B06017P 天草四郎時定** (緑5/YAIBA): 【登場時】このキャラ以外の YAIBA 在場で1ドロー
  (conditional sceneHas{trait YAIBA, excludeSelf}→draw) + 【ヒラメキ】facedown + 【変装】【事件YAIBA】【FILE5】
  (icon-disguise + and[caseTrait YAIBA, fileAtLeast 5])。
- **B06019 クモ男** (緑4/YAIBA): 【事件編】【登場時】手札の緑YAIBA を1枚リムーブしてもよい、そうした場合2ドロー
  (caseStatus{事件編} gate + chain[discard{緑YAIBA, max:1}, draw{n:2}]) + 【ヒラメキ】facedown。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-evidence-flip-facedown-2026-06-23.test.ts、23件): candidates() faceUp filter +
  side=self を裏向き/相手証拠 decoy で witness / runAtom single・multi(cardIds)・同cardId2件・0枚・裏向きtarget-noop /
  順番不変 (位置/cardId 並び不変) / pick-await enqueue / B05013 enter multi-pick end-to-end
  (emit→runAllUntilEmpty→drainAiEffectPicks で表向き2枚を裏向き化、裏向きdecoy・相手証拠不変) /
  B06017 conditional excludeSelf gate (fire/skip) + 変装 descriptor / B06019 caseStatus 事件編 gate + chain discard→draw /
  legacy evidenceFlip(faceup) 回帰。
- **敵対 faithfulness review** (opus workflow、3カード + engine lens): 全 faithful (blocker 0)。
- typecheck 0 (両config) / vitest 2822→2845 (+23 新 test、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip / 規約 lint 8本 errors=0。
