## タスク C: optional 決定の配線 (pendingEffectOptional) + B05019 中道和志

**Round/Phase**: 2026-06-06 session — reasoning 残分類で最有力と判定した engine 機能「optional 決定の配線」を実装。
「〜してもよい」(Effect kind:`optional`) を human に「する/しない」で surface する additive 機構を新設し、
第1号カード B05019 を実装。pendingEffectChoice (BUG-121) と同型・別スロット。

### engine 拡張 (additive — pendingEffectChoice と同型)

`optional` Effect kind は型/validate には在ったが runtime 未配線 (`resolver.ts` の `optionalRun` が
どこからも set されず常に skip) で**使用不能**だった。これを choice 機構と同型に配線:

- **resolve-picks.ts**: `optional` case を書き換え。`ctx.dyn.optionalRun` 指定済→その値で確定 (consume 後 delete) /
  `humanChooser`→`__pendingEffectOptionalSide` を surface して pause (no-op return) + 再開 holder
  `__pendingEffectOptionalResume` に保持 / AI・非human→skip (optional は自己コストを含むため conservative)。
  side-channel/holder の push/drain/clear/peek/take helper を追加 (choice helper と 1:1)。
- **apply-pick.ts**: `applyOptionalAndContinuation(state, pending, run)` を追加。holder を取り出し
  `ctx.dyn.optionalRun=run` で再 walk → run=true なら内部を walk (内部 $pick は pick queue へ再 push) /
  run=false なら no-op → queue + runAllUntilEmpty。
- **UI**: store `pendingEffectOptional` + `setPendingEffectOptional` / dispatch action `optionalResolve{run}`
  (+ isAllowed + runEngineAction case + post-dispatch/surface drain 2 箇所) /
  新 `EffectOptionalModalHost` (card名 + ability description + 「する/しない」、testid `optional-picker-modal`/
  `opt-run-yes`/`opt-run-no`) を App.tsx に mount / `useEffectPickFlowDriver` に AI fallback (非self→run:false)。
- lint-side-channel に `EffectOptionalResume` を engine-internal allowlist 追加。`EffectOptional` は 4 点配線 OK。

### 対応カード (1 枚)

- **B05019 中道和志** (青Lv4): 自分側[毛利小五郎]が推理したとき、このキャラをリムーブしてもよい。そうした場合、
  LP0のキャラを1枚まで選びターン終了時までLP+1。`reasoning:end` + `triggerCharMatches{self,cardName:毛利小五郎}` +
  `optional(sequence([sceneRemove $self, charModifyLP pick lpMin0/lpMax0 +1 turn]))`。

### 検証

- typecheck clean / 全 vitest **1834 pass / 1 skip / 0 fail** (回帰0) / lint (side-channel 11ch errors=0 /
  listener/bugs/card-addition/component-testid/ok-false errors=0) / eslint 0 errors。
- unit `tests/cards/optional-decision-batch.test.ts` 5 件 (surface/する/しない/AI skip/def) +
  `resolve-picks.test.ts` の optional 特性テストを新挙動 (run/skip/human surface) に更新。
- e2e `tests/e2e/optional-decision-2026-06-06.spec.ts` 2 pass (人間経路: する→中道和志リムーブ+LP0キャラ(D08009)LP+1・
  LP1 decoy 除外 / しない→無変更)。回帰 e2e (effect-pick / BUG-121 choice / reasoning-hook) 8 pass。
- ALL_CARDS 957 → **958**。

### 残課題

- optional は**トップレベル**のみ対応 (B05019 は top-level)。sequence 内 optional は未対応 (BUG-121 の
  sequence 内 choice と同様、該当カード 0 で follow-up)。AI は optional を常に skip (policy hook で将来 enhance 可)。
- これで reasoning 残の B05019 を解禁。残: B03038(evidence抑制) / B05080(triggerChar-target) /
  B08034(set-card除去) / B02004系・B04039・D03007(multi-hook共有limit) / B09047(MR2色)。
