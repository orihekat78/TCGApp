### engine E3 増分4 (P10) — パートナー【事件解決】書き換え (あばよ…名探偵!! B03135 ほか、E3 最終)

Track A1 structural、E3 (rule-rewrite/alt勝敗) 分解計画の**増分4 = 最後**。engine-only
(consumer B03135/B05118/B06105 は card phase / card 凍結中 → probe test で検証)。これで engine-first
計画 (E1+E2+E3+MR) の E3 ブロック完了。

「自分の【黒】のパートナーの【事件解決】能力を〚【解決編】【証拠隠滅】【スリープ】証拠を事件レベルの数だけ
リムーブ：相手はゲームに敗北する〛に書き換える」= per-game の【事件解決】書換 + alt-lose 勝利ルート。

- **`partnerSolveOverride` ContinuousModifier flag** (`types/card-def.ts`): case 継続能力。
  **【黒】gate は ability.condition (`{kind:'partnerColor',color:'黒'}`) で表現** (公式Q&A: 非黒パートナー
  は書換不成立)。cannotSolveCase / sceneCapOverride と同流儀。
- **`read.game.partnerSolveOverride(s,p)`** (`read/game.ts`): 自 case def の continuous ability を走査
  (type==='continuous' + continuousModifier.partnerSolveOverride + ability.condition honor)。cannotSolveCase
  の clone。不在時 false = baseline 不変。
- **`mutate.partner.solveCase` の execution 分岐** (`mutate/partner.ts`): override 有効時、通常勝利
  (reason:'evidence') の代わりに 〚証拠を事件レベル(=`case.requiredEvidence`)数リムーブ〛(=【証拠隠滅】cost) +
  `gameResult.set(s,p,'alt-lose')`。全 caller (UI dispatch / AI policy / effect atomPartnerSolveCase) が
  引数不変ゆえ自動で分岐。

**設計判断 — 最小化 (spec 提案の Cost-union / UI・AI override / keyword enum は不要と実証)**:
- override は **canWin の availability を変えず execution のみ差し替え** (alt の前提条件 = 解決編 + active
  partner + evidence≥required は通常 solve と同一。【スリープ】cost=active、証拠リムーブ cost=evidence≥required)。
  → **AI move-enumerator / UI enumerators / dispatch guard は無改変** (T3 最大リスク面を回避)。
- 証拠リムーブ cost は solveCase execution に **bake-in** (通常 solve が【スリープ】cost を bake-in するのと対称)
  → 汎用 Cost-union 追加不要。
- **【証拠隠滅】keyword = display-only** (参照 consumer 0、`grep 証拠隠滅 src` = 空) → engine repr なし。
- 「事件レベルの数」= engine は印字 level 非保持、`requiredEvidence` (先攻7/後攻6) で モデル化。後攻=6 が
  払える (印字7 固定だと後攻が永久に払えず破綻) → `requiredEvidence` が唯一整合的。

**gates**: tsc 両 config=0 / vitest 3761→3772 pass +1 skip (probe +11、regress 0) /
smoke:1000 winsA=498 exceptions=0 (default-off + 全 shipped case 未宣言 → 挙動不変) / 8 tsx lints errors=0。
probe = `tests/cards/e3-p10-partner-solve-override.test.ts` (①override helper 4 / ②solveCase execution 4 /
③canWin availability 2 / ④opp 側対称 1)。tier T3 (flow-core solve/win path) → opus 3-lens 敵対 review
(semantic / additivity+cycle / edge+footgun、全 SHIP_WITH_NITS・0 blocker。dsl-trap は新 DSL 文法なしゆえ subsume)。
review nit 反映: solveCase コメント訂正 (無条件 set) / taskA-validate JSON_CONT_KEYS に override 5 key 追加
(P05/E3 の card-phase false-positive 予防) / partnerColorsOverride disjoint 注記 / evidence:removed queue 注記。
consumer カード無 → Playwright は card phase (card 解禁時に human solve 実機 1 試合)。

**DEFER**: B03135/B05118/B06105 の card authoring (case 継続能力 + partnerColor 黒 condition) は card phase。
B06105 は加えて【宣言】【ターン1】〚裏向き証拠3枚を表向き〛効果 (別 primitive、evidenceFlip pick-3) を持つ。
