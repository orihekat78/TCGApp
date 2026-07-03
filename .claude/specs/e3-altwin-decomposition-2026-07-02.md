# E3 (rule-rewrite / alt勝敗) 分解計画 — 2026-07-02

Track A1 structural、engine 拡張の最終 phase。engine-first 方針の最重・最後ブロック。
grounding = engine-extension-plan-2026-06-30.tsv 行 `rule-rewrite-altwin-delay`。

## 対象 primitive と family

| P | 内容 | cards | risk |
|---|------|-------|------|
| **P10** | パートナー【事件解決】能力の per-game 書換 + 【証拠隠滅】keyword + alt-lose + cost「証拠を事件レベル数リムーブ」 | B03135/B06105/B05118 (計15) | L |
| **P53** | 全証拠表向き化 + 証拠の特徴計数で alt-lose + 自分は事件解決不可フラグ | B09107/P | M |
| **P11** | パートナー全色化 + 現場上限5→4 のルール改変 | PR067 | M |
| P48 | じゃんけん RNG 勝敗 | B07011 | S (pure-additive → **A2 lane**) |

共有コア = **alt-lose verb「相手はゲームに敗北する」** (P10/P53 両用)。

## 増分順 (小 → 大、各 engine-only + probe、consumer は card phase)

1. ✅ **opponentLoses verb** (増分1、出荷済 2026-07-02) — alt-lose 勝利ルート。reason 'alt-lose' + first-writer guard。純 additive。
2. ✅ **P11** (増分2、出荷済 2026-07-02 main 3ec88935): `sceneCapOverride` + `partnerColorsOverride` ContinuousModifier field。
   read/scene-cap.ts sceneCap(s,p) が登場ゲート7サイト集約 (既定5、絶対 invariant は5固定=非強制) / cond/eval.ts partnerColor が override 色で評価。
   latent (全 unreachable、code comment 記録): switchEnter 条件付きcap crash / partnerColor 自己再帰 / bindings依存condition / candidates partner-target。
   ~~旧計画~~ `PlayerState.sceneCapOverride?: number` (5 のハードコード 6サイト集約 → 参照点1本化) +
   `PartnerOnBoard.colorsOverride?: Color[]` (cond/eval.ts partnerColor が読む)。case 在場中 continuous。
   ハードコード集約が本体 = structural だが挙動不変リファクタ寄り。単独 exemplar 可 (PR067)。
3. **P53 evidence 機構** (中): `evidenceFlip` に all モード + `evidenceTraitAtLeast` Condition (証拠を特徴計数) +
   `canWin` に「事件解決不可」override フラグ。alt-lose は増分1で済。
4. ✅ **P10 partner-solve override** (増分4、出荷済 2026-07-03 main bf33786d) — **E3 完了 = engine-first 計画 完了**。
   実装 = `ContinuousModifier.partnerSolveOverride?: boolean` (case 継続能力、黒 gate は ability.condition partnerColor) +
   `read.game.partnerSolveOverride` scan (cannotSolveCase clone) + `mutate.partner.solveCase` execution 分岐
   (override 時 証拠を requiredEvidence 数リムーブ + gameResult.set alt-lose)。
   **設計最小化 (spec 当初案を縮小・実証)**: override は canWin availability 不変・execution のみ差替 → **UI/AI/dispatch 無改変**
   (T3 最大リスク面を回避)。cost は solveCase に bake-in → **Cost-union 追加不要**。【証拠隠滅】は display-only → keyword enum 不要。
   「事件レベル数」= `requiredEvidence` (印字 level 非保持、後攻6 が払える唯一整合値)。opus 3-lens 全 SHIP_WITH_NITS・0 blocker。
   probe = `tests/cards/e3-p10-partner-solve-override.test.ts` (11)。consumer B03135/B05118/B06105 authoring は **card phase**。

## データモデル方針

- alt-lose は既存 `mutate.gameResult.set` 再利用 (新 field 不要)。✅済。
- P11 の override は **per-player state field** (game-state.ts PlayerState / PartnerOnBoard)。ハードコード数値は
  参照点集約してから override 分岐 (骨格凍結原則: 集約は動作不変内部最適化として許容)。
- P10 の partnerSolveOverride は最も侵襲的。canWin (read/game.ts) と solveCase (mutate/partner.ts) と
  UI/AI の solveCase アクション (useEngineDispatch.ts / move-enumerator.ts) を **同時に** override 対応させる必要。

## エッジケース (P10/P53 着手時に必須)

- override 中に事件が事件編へ戻る経路は無い (rules/01 一方通行) → override は解決編前提で安全。
- alt-lose と deck-out/事件解決が同 tick で競合 → first-writer guard で先着優先 (増分1で実装済)。
- P53「事件解決不可」+ alt-lose のみ = 通常勝利ルート封鎖 → canWin が false でも alt-lose verb は独立発火 (別ルート)。
- 【黒】以外パートナーでは P10 書換不成立 (公式Q&A) → override 付与を色 gate。
- cost「証拠を事件レベル数リムーブ」で証拠不足 → コスト不成立 = 能力使用不可 (rules/21)。

## ⚠ authoring 契約 (P10/P53 consumer 着手時)

- **`opponentLoses` の `args.player` は「勝者」** (= 効果所有者)、敗者ではない。
  「相手はゲームに敗北する」カードは `args.player: 'self'` (所有者が勝つ)。`'opp'` を渡すと所有者が敗北に反転する。
  verb 名は opponentLoses だが引数は winner — 最初の consumer 出荷時に card-authoring-checklist へ一行注記する
  (敵対 review 増分1 の指摘)。

## rules 参照
01 (勝敗・一方通行) / 15・25 (即時解決「相手はゲームに敗北する」) / 21 (cost) / 17 (【証拠隠滅】keyword tag) / 20 (色制限・現場上限)。
