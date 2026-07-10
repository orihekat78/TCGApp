---
date: 2026-07-10
seq: 14
slug: m2-attribution-miniwave
---

## M2 attribution mini-wave — byPlayer emit + costPaid write (12 unit + P spread 25 = 37 printings)

roadmap M2 前半。attribution 2 束 ([miniwave-attribution-2026-07-10.md](../specs/miniwave-attribution-2026-07-10.md))
の engine 増分 + 12 unit 一括出荷 + M1 base の P spread 25 枚随伴 (1830→**1867** / 2074、残 207)。

- **engine (additive、骨格凍結内 touch-up)**: ①leave:to-remove payload に byPlayer (効果 owner) 配線
  (mutate/scene.ts 1 点 — opts は W6 step10 で既設、emit 欠のみ) ②removedCharMatches.byPlayer gate
  (owner-relative、legacy caller は fail-closed) ③cost/pay.ts costPaid 書込み 4 case
  (removeFromHand={ids,level} / revealFromHand={ids,count} / sceneToDeckBottom={ids,level} /
  removeSetCard={ids,kinds}) ④costRemovedMatches.key ('removeDeckTop' 既定 = 後方互換)
  ⑤新 Condition costRevealedMatches (3点同期: union + eval case + taskA whitelist)
  ⑥revealFromHand n:{min,max} 拡張 (B08068「好きな枚数」、canPay=min 基準。spec 未記載 gap を実装中に検出・補完)
- **TDD probe**: RED 先行 19 pin (byPlayer 過剰発火/fail-closed/emit 配線/owner-relative +
  costPaid 4 shape + key 後方互換 + costRevealedMatches fail-closed)
- **card 12 unit**: byPlayer 束 = B03116/B05107 (自己蘇生) + B03112 (黒観測) + B04089/B04091/B04094
  (相手キャラ除去観測)。costPaid 束 = B08041 (setCard kind 分岐) + B08068 (公開枚数 dyn 合成) +
  B09005 (costRevealedMatches + fileFlipTop opp) + B09050 (removeFromHand level 継承) +
  B07025 (sceneToDeckBottom level 継承) + B09060 (FBI/赤井家 両立 conditional)。
  probe 76 件 (5 group file、owner=opp pin + decoy pin + production dispatch 経路)
- **P spread 随伴**: gen-p-spread で M1 出荷 base の TSV 全列同文 P twin **25 枚** (B02013P〜B09111P、
  機械証明 slim clone)
- **ゲート**: tsc 0 / vitest 4967 pass (+101、回帰0) / smoke:1000 winsA=472 exceptions=0 /
  8 lint err0 / crosscheck 14/14 / validate-specs 0 fail。T2 混成 review (sonnet5 意味等価 +
  opus 敵対 edge)
- **既知 nit**: handAddFromRemove PB 短縮形の owner=opp 反転は pre-existing gap (BUG-181 系、
  M5 resolver 回で一括修正) — B07025 probe は KNOWN GAP として現状 lock
