# wave-10: B07002 exemplar + boundDistinctColorCount + turn-scoped cutin/変装 ban + BUG-165 multi-pick fix

- **BUG-165 修正 (engine hot-path + UI)**: PB generic multi-pick collapse — n≥2 の Pattern B pick が
  human/AI drain/AI 同期 walk の全経路で先頭 1枚に握り潰されていた。apply-pick.ts generic 分岐を
  `target: allCardIds`、resolve-picks.ts AI 同期 generic 分岐を greedy nMax 枚 (BUG-103 cardIds contract
  同流儀) に修正。**UI 側も playwright 実機で collapse を発見** → HandZone に multi-select
  (toggle+完了ボタン、CardListModal contract) を追加し Playmat discard pick が pickedUids を収集。
  n:1 は byte 不変。shipped 影響 = **B04005/D10012/PR137/PR143** (discard n:2、1枚しか落ちなかった)
  が全経路で修正。handReveal ★未対応(3) 解消。
- **新 Condition `boundDistinctColorCount`** (G17 残): bound 集合内に「filter 一致 かつ 相互に同じ色を
  持たない (色集合 pairwise 交差空、2色カードは rules/20)」カードが n 枚以上。B07002 a1
  「それぞれ色の異なる（同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合」。
- **新 verb `setCutinBan` / `setDisguiseBan`** (turn-scoped use-restrict): `TurnScopedFlags.cutinBanned /
  disguiseBanned` (side-level) + canCutIn/canDisguise gate + resetTurnFlags 清掃。setNextHintBan mirror。
  公式 Q&A (B07002)「使用後このキャラが現場を離れても有効」= side-level flag で担保。action-scoped の
  per-char `cutinBanOpp_action` (wave-0629d) とは別 axis。
- **exemplar B07002/B07002P 江戸川コナン** (ct-p07、SR/SRP): a1 = draw2 → discard2(bind $discarded) →
  conditional(boundDistinctColorCount) → sceneRemove apMax8000 (D02002 VERBATIM 節)。a2 = 宣言 cost
  sleepChar(探偵、self 包含) → setCutinBan+setDisguiseBan (opp)。3 新機構 + BUG-165 fix の初 consumer。
- テスト: 新規 28 (cond 9 / verb+gate 6 / BUG-165 回帰 5 / B07002 probe 8)。tsc 0 / smoke baseline 不変。
