# Task D E0+E2 — pick-bind / sceneToDeck verb / sceneToDeckBottom cost

rules: 09/23(デッキ下移動≠リムーブ・現場リムーブ時不発動) 16(set/stacked リムーブ) 15(〜枚まで=0可)
21(コスト全部実行) 25/26(viaCost・デッキ不足) 19(分割名) 14(リフレッシュ) 03/24(スタン) 18(MR=既存ギャップ継承)

## E0: pick-bind micro-extension (横断 pick-share 解消)

「N枚まで選び、AP+1000 し、突撃を与える」= 1 pick を複数 atom で共有する機構が不在
(charGrantKeyword は bind uid 必須 / ctx.picked 消費 atom ゼロ / B07093 a1 が同形状で DEFERRED 済)。
- 設計: Pattern A pick 解決時 (apply-pick.ts の単一+multi 両経路 / resolve-picks.ts 残存経路) に
  `args.bind` があれば `ctx.bindings[bind] = picked.map(uid=>({kind:'char',uid,...}))` を writeback。
  後続 atom は既存 resolveBindRef の `'$<bind>.uid'` で参照 (sceneEnter の $matched writeback と同型・additive)
- 解禁: B07070(E1)/B07090/B09032/B07079-a2/B02014(いずれも E4 と複合)。BUG-130 (B02040) の検証も可能に

## E2-a: atom verb `sceneToDeck` (sceneToHand 完全同型 = engine-extension #4 流儀)

```
{ kind:'atom', verb:'sceneToDeck', args:{ player, side?, n?|max?, filter?, state?, pos?:'bottom'|'top'(既定bottom), uid? } }
```
- handler: sceneToHand case (atom-handlers.ts:669-689) 複製 — PA短縮形 gate → tryRePickFromAtom / '$pick' skip / resolveBindRef → `mutate.scene.toDeck`
- `mutate.scene.toDeck(s,uid,pos)` 新設: toHand (scene.ts:167-186) 複製、末尾 deck.push (bottom) / unshift (top)。
  rules/16: setCards→remove 表向き、stackedCards→'back-card'。**leave:to-remove は emit しない** (リムーブでない)。
  **leave:to-deck event も今回 emit しない** (購読0・TRIGGERED_HOOKS 外で死にコード化するため。将来 hook 化時に追加)
- 既存 `scene.toDeckBottom` (変装 semantics、rules/16 処理なし) と `selfToDeckBottom` cost は **不変**
- 移動先 = **キャラ所有者の** デッキ (toHand と同じ注意点)

## E2-b: Cost kind `sceneToDeckBottom { target: TargetingRef; n: number }`

- evaluate.ts: candidates >= n (removeFromScene :39-42 複製)。pay.ts: costParams.uids 優先 / pickCandidates fallback → scene.toDeck(bottom)
- ⚠ pay.ts payInner は void 戻りで **case 追加漏れが TS で検知されない** (BUG-116 同型 silent no-op) → pay.test.ts で実移動を必ず固定
- costToText (useActionsPanelFlow.ts:46-65) + 宣言コスト現場ピッカー UI (flipFaceUpEvidence ブロック :564-598 同型、B08076 で必須)
- AI: 変更0で機能 (先頭 n fallback)。populateCostParams 品質向上は任意

## E2-c: triggerCharMatches.excludeSource (micro)

`{ kind:'triggerCharMatches', excludeSource?: boolean }` — eval.ts:230 case に `pl.uid !== ctx.source.uid` を追加 (2行 additive)。
B09002 a1「このキャラ以外の〚工藤新一〛か〚毛利蘭〛が登場」の self 除外 (rules/19 分割名で自己一致するため必須)

## touched files

types/effect.ts (AtomVerb+1, Cost+1, triggerCharMatches 拡張) / effect/{atom-handlers,validate,atom-pick-spec,apply-pick,resolve-picks}.ts /
mutate/scene.ts (toDeck) / cond/eval.ts / cost/{evaluate,pay}.ts / ui/hooks/useActionsPanelFlow.ts /
tests: atom-handlers (sceneToDeck 6本: 基本/top/相手所有者帰属/現場リムーブ時不発動/set-card清掃/空デッキ) + cost evaluate/pay + eval (excludeSource) + pick-bind
scripts/taskA-validate-specs.cjs VERBS/COSTS whitelist

## edge cases

1. 空デッキへの移動 → deck.length=1、リフレッシュ非発生 (rules/14 は「なくなったとき」のみ)
2. PA pick 候補0 → __chainStepNoApply で chain break / max:N skip → '$pick' no-op (既存機構)
3. コスト: candidates < n → canPay false (rules/21)。デッキ0でも支払可 (selfToDeckBottom と同じ)
4. スタン/スリープ状態でも移動可 (state は filter 用、rules/03 特殊挙動は active 化時のみ)
5. 変装後キャラ → 変装後 cardId がデッキへ、引継ぎ効果は消滅 (rules/23)
6. 【現場リムーブ時】持ちをデッキへ移しても不発動をテストで固定 (rules/17)
7. 名乗り/turnEffects は char object ごと消滅。再登場は新規 enter
8. MR の相手ターン離場→パートナーエリア移動は engine 全体の既存ギャップ (isMR 不在) を継承 — 対象14枚に直接 MR 指定なし

## verdicts

B07080(P) ✅ / B04011 ✅ / B08058(P) ✅ / B09002(P) a1 ✅ (excludeSource 込み、a2 は partner-area 句=vacuous 出荷 or DEFER を実装時判断)
D10009/D10010 partial (a3 scene-source charStackCard + 事件名 condition 不在) / B05092 partial (a1 手札→デッキ下+シャッフル+同数draw)
B08036 partial (charSetCard from:'remove' 不在) / B08057 partial (remove→deck 順序付き複数バケット + 件数条件) / B08076 partial (sceneAll condition 不在)
