# Task D E3 — FILE-zone verb 群 + 既存バグ2修正

rules: 03(エリア定義) 05(FILE積順=末尾が最上) 12(ネクストヒント・アシストパートナー除外)
13/17(【FILE(X)】はパートナー含む=file.length) 14/26(リフレッシュ・敗北) 15/25(可能な限り・FILE7必移行)

## 新規 verb / condition / hook (全て additive)

1. **fileRemoveTop** `{player, n, bind?}` — FILE 上から n 枚を **FILE 所有者の remove へ** (mill+fileFrom 流儀)。
   popTop 流用でアシストパートナー自動 skip (B09010/B09108/B09111 Q&A「パートナーカードを除いて」裁定済)。
   **popped 0 枚なら `__chainStepNoApply=true`** (PR100/B09105 Q&A「FILE に無ければ以降解決不可」— pick 経路以外で flag を立てる初例、resolver.ts:62-83 chain が consume)。bind 指定時 ctx.bindings[bind]=cardIds (discard a.bind 流儀)
2. **fileFlipTop** `{player, n?:1}` + `FileCard.card-back` に `faceUp?: boolean` (optional=旧 state 互換)。
   **「最上位の非 assisted-partner カードを特定し、それが既に faceUp なら no-op」** (下のカードへ降りない —
   B09021/B09108/B09023/B09005 Q&A「すでに表向きの場合何も起こりません」)。flip 不発でも **chain は break しない**
   (B09021 Q&A: flip 不発でも後続 AP+1000 可 — fileRemoveTop と非対称であることを明記)
3. **condition fileTopMatches** `{side?, filter?}` — file 末尾 (空なら false、assisted-partner は false) を
   matchOneFilter で評価。「FILE の1番上がキャラの場合」= filter:{kind:'character'}
4. **TRIGGERED_HOOKS += 'file:pop'** + **condition triggerPlayerIs** `{side}` (payload.player vs ctx.source.player) —
   B05050「FILE のカードを手札に加えたとき」(triggerCharMatches は payload.uid 必須で不適合のため新設)
5. **fileAdd handler にデッキ0時リフレッシュ guard** (handler 内 pre-check、auto-phase 経路 :75 不変) — rules/14「FILE に置く」=リフレッシュ後残り解決
6. **dyn `$self.fileCount`** (resolveSelf に faceUpEvidence 同型分岐) — 布石のみ。nested filter dyn は別 gate

## 既存バグ修正 (骨格バグ修正例外)

- **BUG-128 filePopToHand**: placeholder でなく popped.cardId を hand.add + `event.emit('file:pop', {player,popped})`
  (next-hint.ts:66-74 と対称化)。**popped 無しなら __chainStepNoApply=true** (B04068「加えてもよい。そうした場合」)。
  ⚠ 既存テスト atom-handlers.test.ts:99-115 が placeholder を assert (fixture :106 は cardId 欠落) → テスト修正同梱
- **BUG-129 cost fileFrom**: pay.ts:111-117 が popTop 戻り値破棄 → カード消失。remove.add 追加。
  **水平展開**: canPay (evaluate.ts:60-62) も assisted-partner 込み計数 → `file.filter(f=>f.type!=='assisted-partner').length >= n` に修正
  (rules/21 全部行えなければ使用不可)。FILE=[assisted-partner]のみ の canPay テスト追加。影響カード B05037 回帰確認

## UI / docs

- FileArea.tsx FileCardItem に faceUp 分岐 (resolveCard prop 既存)。CardListModal も faceUp のみ表向き (cardId leak 禁止)
- LogPanel.tsx action label +2 / taskA-validate-specs.cjs VERBS/CONDS whitelist / npm run docs

## touched files

types/effect.ts (+2 verb, +2 cond) / types/game-state.ts (faceUp?) / effect/{atom-handlers,validate}.ts / cond/eval.ts /
listeners/triggered.ts (+1 hook) / mutate/file.ts (flipTop) / dyn/eval.ts / cost/{pay,evaluate}.ts /
ui (FileArea/LogPanel) / tests (atom-handlers + cond/eval + cost + 既存 filePopToHand テスト修正)

## edge cases

1. FILE 0枚 / アシストパートナーのみ: fileRemoveTop=chain-break、fileFlipTop=no-op (非 break)、fileTopMatches=false、canPay fileFrom=false
2. fileRemoveTop n:2 で FILE 1枚: 可能な limit まで取り **「してもよい」全部実行不能時は実行不可** が正
   (B09105 Q&A) — optional+chain 側で cost 的に扱う実装カードの責務、verb 自体は取れた分 remove
3. top 既表向き → fileFlipTop no-op (Q&A 裁定)。表向きカードは情報公開状態を UI で維持
4. fileAdd デッキ0: リフレッシュ→残り解決 (rules/14)。リムーブ0でリフレッシュ→敗北は既存 refresh 経路
5. FILE>=7 自動解決編移行 (mutate/file.ts:29-31) は fileAdd 経由で自動 (rules/25 必移行)
6. file:pop はネクストヒント(:74)とfilePopToHand 両方から emit — B05050 の「ネクストヒントで加えた場合使用後解決」
   Q&A は E2E で順序確認 (イベント先解決の強制)

## verdicts

B09021(P) ✅ / PR100・PR106 ✅ / B04064 ✅ (use-gate は B02032 前例の condition 近似、semantics 差を DEFERRED-INDEX 注記) /
B04068(P) ✅ / B05050 ✅ (E2E 順序確認付き) / B09010 ❌ multi-card sceneEnter 不在 (過大評価を検証で却下) /
B09003/B09108/B09111/B09052 partial (name-designation 別 gate) / B08060/B05102 partial (nested dyn) /
B09019/B09105/B09033/B09023/B09005 partial (bound-count / distinct-levels / repeat-N / contact-リムーブ trigger / reveal-cost)
