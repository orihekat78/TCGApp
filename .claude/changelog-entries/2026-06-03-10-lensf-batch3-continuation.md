---
date: 2026-06-03
title: Lens F 監査 修正バッチ3 — 継続課題 3 件 (BUG-106 AI単一PB / BUG-107 bind伝播 / BUG-108 choiceIndex)
type: fix
scope: engine+ui
---

## BUG-106 — AI 単一 Pattern B pick (D11014 a2 sceneEnter) の walk 解決

`substituteAtomPick` の AI 経路に `cardId:'$pick.cardId'` branch を追加 (BUG-103 の `cardIds` branch と同型)。
CPU がリムーブの警察 Lv5 を登場できず萩原千速の 1 ドローも不発だった silent no-op を解消。
副作用として現場満杯時の効果駆動 sceneEnter が throw する pre-existing gap が露呈 → handler に
「現場満杯なら登場 skip」guard を追加 (rules/15「可能な限り行う」、source-splice 前判定でカード消失防止)。

## BUG-107 — D11014 a2 `$entered` bind を pick-resolve 越しに伝播 (human 経路)

`useEngineDispatch.effectPickResolve` の continuation 分岐を、保存 ctx を直接使う `runEffect` 実行に変更。
pick 解決した sceneEnter atom と continuation remainder (conditional) を **同一の保存 ctx** で実行することで
`$entered` bind を共有 (従来は別 `event.queue` で Immer draft に取り込まれ proxy 化して bind が消失していた)。
D11007 a3 の uid drop も保存 ctx 使用で解消。

## BUG-108 — D11012 a1 choice 択一 UI (LP＋1 / AP＋2000)

- engine: `resolveEffectPicks` の choice を `ctx.dyn.choiceIndex` 指定時に選択 option へ unwrap (walk 中 bake)。
- engine: `useDeclaredAbility` が selfToDeckBottom コストで場外へ移った source を `ctx.source` から救済解決。
- ui: `useChoicePicker` + `ChoicePickerModal` 追加、`runDeclaredAbilityFlow` が複数 option の choice で modal ask →
  `ctx.dyn.choiceIndex` に積む。Playmat に mount。複数 option choice は D11012 a1 のみ (他 8 箇所は単一 option)。
- human 経路完了。AI fan-out は BUG-109 と併せ DEFERRED。

## BUG-109 — PA 短縮形 atom の AI no-op (新発見・DEFERRED)

charModifyAP/LP・短縮形 sceneEnter 等の PA 短縮形が AI 経路で全て silent no-op (疾風 AP-1000・D08024
reanimate・D11012 a1 AI fan-out が不発)。walk が PB 短縮形のみ展開し、runtime の tryRePickFromAtom が
humanChooser:true 強制 + AI drain 不在のため。**user 判断で次の focused セッションへ** (smoke baseline シフトを伴う)。

## 検証

tsc clean / vitest **1688 PASS** (+新規 10 件: bug-106 reanimate 3 / bug-107 bind 2 / bug-108 choice 5) /
smoke 1000 例外0 (baseline OK avg10.69) / **Playwright 65 PASS** (+choice modal e2e 2、UI 回帰なし) /
lint:side-channel 新規エラー0。
