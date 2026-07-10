---
date: 2026-07-10
seq: 15
slug: m2-latter-batch
---

## M2 後半 batch — set-card / dyn-counter / cutin-filter cluster (16 + P spread 14 = 30 printings)

roadmap M2 後半。grounding 3 cluster 並列 (sonnet5、DEFER 行 stale 5 箇所検出) → engine additive
14+1 点 + 15 unit (+PR240 twin) 一括出荷、P spread 14 随伴 (うち 6 は M2 前半の stale-dump 積み残し
回収。1867→**1897** / 2074、残 177)。B02039 は T3 (UI 配線) で M3 送り。
gen-p-spread.cjs ROOT hardcode を env (CONAN_ROOT) 対応に恒久 fix (worktree 運用で spread 0 件になる latent)。

- **engine (additive 14 点、骨格凍結内 touch-up)**: ①atomMill n:{dyn} handler-local 解決 (PR265)
  ②drawUpToHandSize bind (B04048) ③handToDeckBottom n:{dyn} + shuffleMoved (B04048)
  ④sceneEnter cardIds-multi bind (B09019、scene-full-skip 非計上) ⑤charSetCard cardIds faceUp
  opt-in honor (PR234 — grounding 誤り検出: B08036 は引数無し裏向き依存 → 既定反転せず opt-in で
  byte 互換) ⑥handAddFromRemove target resolveBindRef (PR234 $trigger.setCardId)
  ⑦turn.ts toHandOnTurnEnd consume (B05063) ⑧TargetFilter.cutinTextIncludes (D06003 family、
  qAndA 文字列包含 = ウォッカ B01097 除外。4-site 同期) ⑨lvlDeltaInHandPer per-count (B07008)
  ⑩atomDiscard chooser:'source' (B07100 cross-side pick、BUG-175 infra 流用)
  ⑪Cost selfLpDeltaTurn (B06003、canPay 恒真 rules/19) ⑫Cost removeFromHandDownTo (B08047、
  canPay 恒真 = 公式Q&A) ⑬handleLeaveToRemoveSelf の on-set-host rider walk (B01057、
  payload.removedChar.setCards entry 単位 = 2枚セット2発動) ⑭TargetQuery.area 配列 union
  (PR234 hand∪remove 1 pick + charSetCard splice 対応) ⑮resolve-picks resolveDynArgs の
  walk-literalize 根本 fix — 未 bind $bound.* dyn は literal 化を保留し handler-local 解決に委譲
  (production 経路でのみ発現、card probe が検出。bind 済/非 $bound は従来どおり = byte 互換)
- **TDD probe**: RED 先行 45 pin (3 file — dyn-bind 11 / setcard-turn-filter 14 / bundleB 12 +
  byte 互換 pin 8)。機械ゲート: tsc 0 / full vitest 5001 pass (減なし) / smoke winsA=472
  exceptions=0 byte-identical / whitelist 3 点同期
- **card 15 unit**: cutin-filter = D06003+D06004+D06021+D06023 (印字同文 4 spread) + B07100。
  set-card = PR234+PR240 (同文 twin) + B01057 (leave:to-remove rider 初 consumer)。
  deck/scene = B05063 (事件、toHandOnTurnEnd rider) + PR265 (mill dyn) + B09019 (5枚登場計数)。
  hand-cycle = B04048 (declareName + deckRevealUntil 合成) + B06003 (MR、sceneLpSum 主 consumer)。
  counter = B07008 (per-count hand level) + B08047 (drawUpToHandSize dormant 解禁) + B06066 (MR、GREEN)
- **T2 混成 review (semantic sonnet5 + edge fable)**: semantic BLOCK 1 = 誤検出 (B07008 QA の主語は
  B01005 側で、shipped $trigger.cardLevel が既に充足 — 一次資料裁定で棄却)。edge BLOCK 3 = 同 wave 内修正:
  ①B05045/B08086 cutin description 半角 + → 全角 ＋ 統一 (TSV master 準拠 rules/28、cutinTextIncludes
  偽陰性の解消) ②B07100 discard に side:'opp' 明示 (CPU 所有時の手札反転 = BUG-181 family 回避)
  ③PR234/PR240 union area 順を remove 先に (両 zone 同名併存時の消費先、恒久 fix は nits 節)。
  probe pin 3 追加。resolver guard は敵対反証不成立 (shipped 依存 0、B08028 宣言経路をむしろ修復)。
  B09019 ban 句は optional 外へ是正 (「そうした場合」節外の独立文 = rules/15 必須効果、字義裁定)
- nits = DEFERRED-INDEX「M2 後半 batch nits」節 (B07003 latent / head-fixed cost pick / normalizeSource)
