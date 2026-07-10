---
date: 2026-07-10
type: feat
scope: engine+cards
title: mini-wave #5 deck-reveal 拡張 — fromBottom + deckPlaceSplitBound + 3 printings
---

engine mini-wave #5 (cluster ③ 前半、grounding = specs/miniwave5-deck-reveal-grounding.md)。
additive 3 変更: ①deckRevealUntil `fromBottom` param (デッキ下から走査、既存 ~60 消費者 byte 互換)
②新 atom `deckPlaceSplitBound` (「見た各カードを上か下へ」— human は side-channel await →
新 UI **DeckPlaceModalHost** (2-bucket 振り分け + deckPlaceResolve multiset 検証)、AI は恒等 =
smoke 不変) ③bindKey 書込みの matched 除外を bindMatch ペア時のみに gate (bindMatch 省略 =
window 全体保持。既存 168 消費者は全部ペア、grep 実測で挙動不変)。
cards: **B03049/B03049P** (デッキ下1枚公開→白 lv≤FILE 必ず登場 / 他は手札、cost self→remove) +
**B05047** (【登場時】【変装時】dual-hook 上2枚 top/bottom 振り分け) = 3 printings、1788→**1791**。
検証: RED probe 9 → GREEN / manual probe 9 (production dispatch、分岐 3-way + disguise:into 実 emit) /
gen probe 2 / **e2e playwright** (modal 表示・window 2枚制限・振り分け→deck 反映・console 0) /
full vitest 4614+9 / smoke 472 exceptions0 baseline OK / 8 lint err0。
author=opus + verify=sonnet5 EQUIVALENT ×2 (B03049 は B01052 同型の明示 conditional 推奨を採用)。
B01022 (multi-deploy、T3) は grounding 済で次 wave へ切り離し。
