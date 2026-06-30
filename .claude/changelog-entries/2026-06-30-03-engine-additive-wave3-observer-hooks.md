# engine additive wave-3 (observer-hook 群) — cutin:used / misread:performed / evidence:removed + triggerCutinMatches

**Round/Phase**: 2026-06-30 engine-first フェーズ E1 wave-3 (engine/observer-wave3)。engine-extension-plan-2026-06-30 の
「observer-hook 群」を origin/main (3c0bc702) 実 grep で stale 排除 (5 token 全て genuine-absent を確認) 後、純 additive な
3 TRIGGERED_HOOK + 1 matcher を **まとめて** 出荷 (0629d/wave-2 方式)。カード自身は別 card phase で出荷 (本 wave は engine 足場 +
専用 unit test のみ、engine-only)。P20(remove:exit、離場 snapshot + refresh per-card emit の別 sub-pattern) は wave-4 へ。

## engine 拡張: 純 additive 観測 hook 3 件 + matcher 1 件 (新 hook = 既存カードが trigger.hook 未宣言 → handleHook が queue せず挙動不変)

設計共通: 3 hook とも listener = **在場の第三者キャラ** → 既存 `handleHook` (in-play scan) で処理 = 特別 handler 不要
(leave:to-remove / evidence:remove-by-action のような virtual-location handler は不要)。挙動不変の機序:
registerTriggeredListener が全 TRIGGERED_HOOKS に handleHook を登録するため emit は in-play scan を行うが、既存カードは
新 hook を trigger.hook に宣言しないため一致 ability 無し → effect を一切 queue しない (= pendingEffects 不変、smoke winsA=498 で実証)。

1. **`cutin:used` hook** — [flow/contact.ts](../../src/engine/flow/contact.ts) `cutIn` が既存 effect:declared(cutin 自効果ゲート)
   の直後に per-use emit。payload={player(使用側),cardId}, source.bindings に contact を渡す。自効果(effect:declared+optional)と
   第三者観測を **別 hook** で分離。→ B02080 三池苗子「コンタクト中に自分が【カットイン】を使用したとき、そのキャラを AP+1000」
   / B09086(使用カットインの名/特徴で分岐) / B04090(自カットイン使用でリムーブから登場)。
2. **`misread:performed` hook** — [listeners/misread.ts](../../src/engine/listeners/misread.ts) の AI defender 経路 +
   [ui/hooks/useEngineDispatch.ts](../../src/ui/hooks/useEngineDispatch.ts) misreadResolve(人間 defender) が、misread した各キャラ
   **1枚ごとに** emit (公式Q&A=1枚ごとに発動)。payload={player(実行側)}, source.uid=misread キャラ uid。→ B05015 小嶋元次
   「相手が〚ミスリード〛したとき、ターン終了時まで AP+3000」(side:opp) / B09016 円谷光彦「このキャラが〚ミスリード〛したとき…
   アクティブにする」(selfOnly)。両 defender 経路で emit しないと観測カードが片側 false-green になるため双方に配線。
3. **`evidence:removed` hook** — [mutate/evidence.ts](../../src/engine/mutate/evidence.ts) removeTop/removeAt/toRemove
   (=証拠→リムーブの全出口) が remove へ push 後に emit。payload={player(持ち主)}。toDeckTop(=デッキへ戻す) は「リムーブ」では
   ないため除外。既存 evidence:remove-by-action(ヒラメキ、remove 前・原因限定) とは別タイミング・別原因範囲 = 原因非依存
   (公式Q&A: アクション以外の効果リムーブでも発動)。→ B02062 世良真純「相手の証拠がリムーブされたとき、カードを1枚引く」(side:opp)。
4. **`triggerCutinMatches` matcher** — [cond/eval.ts](../../src/engine/cond/eval.ts) cutin:used payload の使用カットイン(cardId)を
   TargetFilter で評価 (setCardMatches と同式、cutin カードは scene char でないため matchOneFilter の char 引数=null = CardDef 印字
   属性のみ)。cutin に faceUp 概念は無いため setCardMatches の faceUp gate は不要。→ B09086([諸伏景光]/[長野県警] で分岐)。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- tsc 0 / vitest **3453 → 3461 pass** +1 skip (新規 8: P23 cutin:used 3[self発火/opp非発火pin/triggerCutinMatches一致不一致] +
  G04 misread 1[AI defender→side:opp観測 & selfOnly自己観測] + G05 evidence 4[removeTop/removeAt/toRemove + 自証拠pin非発火])。
  全 test は実 emit 経路 (contact.cutIn / misread listener / mutate.evidence) を produce+drain で踏む (event.emit 直叩きの false-green 回避)。
- sync-taskA-whitelists green (HookName ⇔ TRIGGERED_HOOKS ⇔ scripts/taskA-validate-specs.cjs HOOKS に 3 hook、CONDITION_KIND_MAP ⇔
  CONDS に triggerCutinMatches、4箇所登録)。
- smoke:1000 **winsA=498・winsB=502・timeouts/exceptions 0** = baseline 不変 (= 新 hook を購読する既存カード 0 件・emit no-op の実証)。
- 8 lint errors=0。engine-only (card consumer 無) ⇒ playwright N/A (0629d/wave-2 同方針)。
