---
date: 2026-06-03
title: 常時有効型 apDelta/lpDelta を engine 配線 + D08005 a1 を dyn 宣言形へ (BUG-095)
type: fix
scope: engine
---

## 常時有効型 AP/LP 修正子の配線 (BUG-095)

D08005 a1「【自分ターン中】自分の表向きの証拠1つにつき AP+1000」が、
`continuousModifier.apDelta` を engine が一切読まないため **デッドコード** (AP に未反映) だった。
user 指摘 (「a1 が単純実装でない」) の調査で判明。

### 修正 (骨格バグ修正例外 — 未配線の常時修正子)

- **eval.ts**: dyn root `$self.faceUpEvidence` 追加 (ctx.source.player の表向き証拠枚数)。
- **card-def.ts**: `ContinuousDelta` 型 (`number | {dyn} | closure`) を新設し apDelta/lpDelta を拡張。
- **read/char.ts**: `continuousDelta()` を追加し `ap()`/`lp()` に合算配線。grantKeywords walk と同経路で
  condition を evalCond で gate、dyn 式 ({dyn}) / closure / 定数を解決 (NaN ガード付)。
- **D08005 a1**: closure を `apDelta:{dyn:'$self.faceUpEvidence * 1000'}` の dyn 宣言形へ (D08007 同型)。

### 動作

read 毎再計算なので rules/24-25 常時有効型 (条件成立中のみ有効・条件外で即失効・枚数増減に追従) を満たす。
charModifyAP atom (スナップショット) では表せない挙動。

### 検証

- tsc clean / vitest **1658 PASS** (+4 behavioral: 表向きN枚→AP+N×1000 / 相手ターン失効 / owner=opp / 裏向き除外) /
  smoke 1000 例外0 (502/498 不変)。
- adversarial verify workflow 3レンズ (correctness / regression-horizontal / rules-semantics) 全て sound。
- 水平展開: closure 形 AP/LP は D08005 a1 が唯一。grantKeywords-only continuous は誤加算なし。
- convention 規則6 を「apDelta/lpDelta は dyn 宣言形・推奨 + `$self.ap/$self.lp` 参照禁止 (再帰回避)」へ更新。
