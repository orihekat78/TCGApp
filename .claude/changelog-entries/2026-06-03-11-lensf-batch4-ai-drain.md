---
date: 2026-06-03
title: Lens F 監査 修正バッチ4 — AI PA 短縮形 pick drain (BUG-109)
type: fix
scope: engine+ai
---

## BUG-109 — PA 短縮形 atom が AI/CPU 経路で silent no-op

charModifyAP/LP・sceneSetState・sceneRemove・短縮形 sceneEnter 等の PA 短縮形 atom は walk で展開されず
(walk は PB 短縮形のみ展開)、runtime の `tryRePickFromAtom` (humanChooser:true 強制) で
`__pendingEffectPickQueue` へ積まれるが、AI には drain 機構が無く no-op だった (疾風 AP-1000・D08024
reanimate・D11012 a1 の効果が CPU で不発)。

## 修正 — AI drain (runtime resolution)

walk-expand は cross-step sequence (D08024 step2 が step1 登場キャラを対象) を pre-state で解決できないため、
runtime resolution の **AI drain** を採用。

- 新 engine module `src/engine/effect/apply-pick.ts`:
  - `applyPickAndContinuation` — pending pick の resolved atom build (Pattern A/B) + 保存 ctx の runEffect
    継続実行 (BUG-107)。human (useEngineDispatch.effectPickResolve) と AI (drain) の **共通実体**。
  - `drainAiEffectPicks(state, policy)` — `__pendingEffectPickQueue` を heuristic で順次解決 (safety cap 64)。
  - `resolveCardIdFromPickUid` を useEngineDispatch から移設 (重複排除)。
- `policy.playTurn` が applyMove + runAllUntilEmpty 後に `drainAiEffectPicks` を呼ぶ
  (useOppTurnDriver も playTurn 経由のため UI CPU 戦も同時カバー)。
- `useEngineDispatch.effectPickResolve` を共通 helper 呼出に refactor (human 経路は同一挙動)。

## smoke re-baseline

CPU が 疾風/reanimate/buff を使うようになり smoke 1000 が legitimate にシフト (avgTurns 10.64→10.86、
winsA 511→469、例外0)。`smoke-baseline.json` を更新。`check-smoke-baseline.ts` の連番 numeric sort bug
("smoke-...-2" > "smoke-...-13" で古い report を最新誤認) も修正。

## 残

D11012 a1 の AI **intelligent 択一** (choiceIndex を AI が AP/LP で選ぶ) は branch 評価が必要で低優先
(現状 AI は既定 option0=LP+1 を drain で適用、機能はする)。

## 検証

tsc clean / vitest **1690 PASS** (bug-109-ai-pa-drain 2 件: D11014 a1 charModifyAP / D08024 cross-step sequence) /
smoke 1000 例外0 (re-baseline、check OK) / Playwright **65 PASS** (human pick 経路 refactor 回帰なし)。
