---
date: 2026-06-03
title: 現場カードの AP/LP 表示を修正反映後の有効値に (BUG-110)
type: fix
scope: ui
---

## BUG-110 — カード下の AP/LP が修正を反映しない

現場キャラの AP＋XXXX / LP＋X (turn 修正・continuous modifier) が `turnEffects` / read.char 側でのみ
合算され、`SceneArea` の表示は `ch.apOverride ?? meta.ap` (印字 base) のままだった
(例: 横溝重悟 AP＋2000 後も 4000 表示)。

## 修正

- `SceneArea` に `resolveCharStats?: (uid) => { ap; lp }` prop を追加し、`read.char.ap/lp` の **有効値** を表示。
- 印字 base と異なる場合 `.modified` + `data-mod`(up/down) を付与し、CSS で **buff=緑 / debuff=赤** に着色
  (AP＋XXXX/LP＋X が反映されているか視認可能に)。`Playmat` が self/opp 両側に配線。

## 検証

tsc clean / vitest **1693 PASS** (SceneArea buff/debuff/同値/override 4 ケース追加) / 実機 Playwright で
buffed AP＋2000→6000(緑) / debuffed AP−1000→4000(赤) / plain→base を DOM 確認、console error 0。

## 補足 (誤検知だったもの)

事件カード下の「必要証拠 N（先攻/後攻）」が「両方先攻」に見えた件は、検証用に注入した state で
`self.case.requiredEvidence=7` にしていたためで、実ゲーム (先攻=7/後攻=6, rules/01) では正しく
self=6(後攻)/opp=7(先攻) 表示。Playmat の turnOrder 導出 (requiredEvidence===7→先攻) は正常。
