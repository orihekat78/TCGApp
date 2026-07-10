---
date: 2026-07-10
seq: 11
slug: s2-deck-cluster
---

## S2 deck cluster — deck-window multi-deploy + 非所有者 deck-place + souza dyn X + remove 3-tier (5 printings)

roadmap S2 消化。deck 操作系 DEFER 4 unit を 1 session で解禁・出荷 (1791→**1796** / 2074、残 278)。

- **B01022 少年探偵団** (T3): 「上から6枚見て lv4以下[少年探偵団] 2枚まで登場、残りシャッフルして下」。
  engine: TargetQuery.fromGroupCards (bound card 集合への pick 母集合制限、player/area/index キー照合) +
  deckRevealUntil bind entry に deck 位置 index 同梱 (重複 cardId 区別) + sceneEnter cardIds-multi
  deck-splice の stale-bind prune (deep copy 誤 splice 防止)。UI: CardListModal kind 'deck' (window のみ表示、
  gameState.deck 直読み禁止) + Playmat pickAreaKind + findFaceUpPickUid nth-occurrence fallback +
  DeckRevealOverlay の deck-window pick hold。Playwright 実機 (multi-pick 2枚登場 + 候補 gate + console 0)。
- **B01093 目暮十三** (T2): 「相手デッキ top 1 公開、自分が上か下かを選ぶ」。deckPlaceSplitBound の
  chooser gate を対象デッキ所有者 → **ownerPlayer (ability owner)** に是正 (BUG-175 パターン、
  B05047 は byte 互換 — e2e 回帰 pass)。ミスリード1 + ヒラメキは共通クラス clone。
- **B02072/P 降谷零** (T1→実質 T2): 「捜査X (X=現場[警察]数)、発見 levelSum 以下を1枚リムーブ」。
  DEFER は stale (両 dyn 出荷済) — 唯一の実 gap = chain 経路で souza x:{dyn} が未解決のまま handler 到達
  → resolveDeltaToNumber 数値化 (+5行、BUG-114 同型)。B04074 双子 chain 骨格 re-mix。
- **B08057 宮野エレーナ** (T2): remove 3-tier pick (lv5/4/1 各1まで EXACT) → deck 下 + 「合わせて3枚」gate。
  engine additive: removeAreaToDeckTop bindKey accumulate + Condition boundCountCompare +
  atom deckBottomReorderBound (BUG-136 並べ替え modal 流用)。
- **D06013 白馬探**: grounding で T3 確定 (unstable-if conditional 内 Pattern-A pick の pre-walk over-fire、
  修正 2 点セット = resolve-picks 抑止 + sceneSetState $pick fallback)。S3+ 単独枠へ。
- BUG-180 水平展開: cost removeDeckTop / sceneEnter cardIds-multi も post-take deck0 refresh gap 同類と追記。
- gates: tsc0 / vitest **4662+1** (baseline+36) / smoke 472 exceptions=0 baseline 一致 / 8 lint err0 /
  crosscheck 14/14 / e2e 5 spec pass。混成 4-lens 敵対 review (sonnet5×2 + opus×2、T3)。
