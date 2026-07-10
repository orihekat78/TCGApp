---
date: 2026-07-10
type: feat
scope: engine+cards
title: mini-wave #4 hand 内 continuous level — lvlOverrideInHand/lvlDeltaInHand + 4 printings
---

engine mini-wave #4 (cluster ⑧、hybrid-batch3/4 DEFER 解禁)。additive 2 primitive:
`ContinuousModifier.lvlOverrideInHand` / `lvlDeltaInHand` + 単一ソース helper
`effectiveHandLevel` (hand-use-card.ts、colorIgnoreOnHandUse と同流儀の自 def walk +
condition honor、override 先→delta 加算の rules/19 二段合成)。consumer 4 site 配線 =
levelAllowed / next-hint.ts step2 / UI flows.toCandidate / handUseReason (全 gate+表示が
有効 hand level を読む。scene 側 level 読みは不変 — 公式 QA「手札にある間だけ」)。
validator JSON_CONT_KEYS +2。

cards 4 printings: B01009/B01009P 工藤新一 (パートナー青+両現場計6枚以上→手札内レベル4、
宣言 selfToDeckBottom→LP0以下の青 1枚まで有効LP判定でアクティブ (スタン→スリープ)) /
B09095/B09095P ベルモット (突撃、事件赤&黒+解決編+自ターン+痕跡発見済→手札内レベル-2、
登場時 痕跡未発見→相手デッキ上2枚リムーブ)。shipped 1745→**1749** / corpus 2074 (残 325)。

TDD probe: engine 9 (RED→GREEN) + card 16 (production dispatch: activateDeclaredAbility /
enter emit / canHandUseCard / runNextHint 実駆動、decoy 除外・スタン特殊・有効LP QA・0枚 skip pin)。
gates: tsc0 / vitest **4604+1skip** / smoke winsA=472 exc0 / 8 lint err0 / crosscheck 14/14 /
混成 2-lens review (sonnet5 semantic + opus edge)。
