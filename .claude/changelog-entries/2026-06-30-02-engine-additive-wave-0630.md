# engine additive wave 0630 (4 pure-additive 評価器) — evidenceDiff / sceneCountCompare / removeColorAtLeast.cardKind / sceneColorNot dyn

**Round/Phase**: 2026-06-30 engine-first フェーズ E1 wave-2 (engine/eval-wave2)。engine-extension-plan-2026-06-30 の
「new-Condition/dyn 群」を origin/main (8f715c92) 実 grep で stale 解消後、純 additive な自己完結評価器 4 件を **まとめて** 出荷
(0629d 方式)。カード自身は別 card phase で出荷 (本 wave は engine 足場 + 専用 unit test のみ、engine-only)。

## engine 拡張: 純 additive 4 件 (新 symbol / optional field = 既存カード未参照 → 挙動不変)

1. **`evidenceDiff` cond** — [cond/eval.ts](../../src/engine/cond/eval.ts) `players[player].evidence − players[other].evidence >= n`
   の state 直読 (ctx 非依存 ⇒ queue 境界安全)。evidenceAtLeast (片側閾値) では差を表現できない。→ B05103「籌を帷幄の中に運らし…」
   「相手の証拠が自分の証拠より2つ以上多い場合」(player:'opp', other:'self', n:2)。
2. **`sceneCountCompare` cond** — 自他現場キャラ枚数を 5 比較子 (lt/le/gt/ge/eq) で比較 (`.scene.length`、oppSceneCount 同流儀)。
   handCountAtLeastOther の scene 一般化版。→ B05081 威嚇射撃「自分の現場にいるキャラが相手の現場にいるキャラより少ない場合」(cmp:'lt')。
3. **`removeColorAtLeast.cardKind`** — 既存 removeColorAtLeast に optional cardKind を追加し色 AND カード種別で計数。
   未指定は従来通り全種別 (回帰0)。field 名は discriminant `kind` と衝突するため `cardKind` (TargetFilter.kind 同値)。
   → B08004 江戸川コナン「リムーブエリアに【黒】の**キャラ**が3枚以上ある場合」(黒イベントを数えない)。
4. **`$self.sceneColorNot.<color>` dyn** — [dyn/eval.ts](../../src/engine/dyn/eval.ts) resolveSelf に現場の「指定色以外の色を持つ」
   キャラ計数 prop (colorNot some説、公式 B08079 = `colors.some(x => !nots.includes(x))`)。sceneTrait/oppSceneCount と同じ player ベース
   (uid 要件前)、continuousDelta 再帰非経由。→ B02002 江戸川コナン「自分の現場にいる【青】以外の色を持つキャラ1枚につき AP+1000」。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- tsc 0 / vitest **3433 → 3452 pass** +1 skip (新規 19: evidenceDiff 5 + sceneCountCompare 5 + removeColorAtLeast.cardKind 4 +
  sceneColorNot 5。各 test に false-green 防止 decoy: 負の差 / 全 cmp / 黒イベ除外 / 単色青非該当 / opp-side 解決 / AP read 経路到達)。
- sync-taskA-whitelists green (CONDITION_KIND_MAP ⇔ scripts/taskA-validate-specs.cjs CONDS 両方に evidenceDiff/sceneCountCompare 登録)。
- smoke:1000 **winsA=498・winsB=502・timeouts/exceptions 0** = baseline 不変 (= 既存カードのパス不変の実証)。
- 8 lint errors=0。engine-only (card consumer 無) ⇒ playwright N/A (0629d 同方針)。
