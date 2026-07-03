### engine E3 増分3 (P53) — 証拠 alt-lose 機構 3 primitive (犯人たちの犯行 B09107)

Track A1 structural、E3 (rule-rewrite/alt勝敗) 分解計画の増分3。engine-only・純 additive
(consumer B09107 は card phase / card 凍結中 → probe test で検証)。共有コア opponentLoses verb は
増分1 で出荷済。本 wave は B09107「犯人たちの犯行」の残り 3 機構:

- **evidenceFlip all-mode** (`atom-handlers/core.ts atomEvidenceFlip`): `a.all===true` で
  自分の全証拠を faceUp 化 (「自分の証拠をすべて表向きにする」)。順序不変・0 枚 no-op。
  既存 idx/fromTop/pick 分岐の手前に挿入 (all は既存カード未使用 → byte 不変)。
- **evidenceTraitAtLeast Condition** (`cond/eval.ts`): 証拠エリアの特徴計数 >= n
  (「自分の証拠に〚特徴［犯人］〛のカードが8枚以上ある場合」)。removeTraitAtLeast と同型
  (remove→evidence 読替、trait 単一/配列 any-match、cardId→lookupCardDef.traits、向き非依存)。
  CONDITION_KIND_MAP + taskA-validate-specs CONDS 両登録。
- **cannotSolveCase flag** (`types/card-def.ts ContinuousModifier` + `read/game.ts`): case 継続能力
  「自分は【事件解決】できない」。read.game.cannotSolveCase が自 case def の
  continuousModifier.cannotSolveCase を走査 (type==='continuous' + ability.condition honor、
  sceneCapOverride/partnerColorsOverride と同流儀)。**3 gate** を同時に塞ぐ:
  read.game.canWin (engine) / ai.canSolveCase (move-enumerator) / ui.canSolveCaseForUi。
  通常勝利ルート封鎖 → alt-lose (opponentLoses) のみ残す設計。mutate.partner.solveCase 自体は
  無ガード (caller が gate、既存設計と整合)。不在時 false = baseline 不変。

alt-lose「相手はゲームに敗北する」= 増分1 opponentLoses verb (canWin と独立発火、canWin false でも成立)。

**gates**: tsc 両 config=0 / vitest 3738→3750 pass +1 skip (probe +12、regress 0) /
smoke:1000 winsA=498 exceptions=0 (default-off + 未使用 → 挙動不変) / 8 tsx lints errors=0。
probe = `tests/cards/e3-p53-evidence-altwin.test.ts` (①all-mode 3 / ②trait-count 4 / ③solve-gate 5)。
tier T2 (additive 評価器 + read-gate 3-site 配線、hot-path/GameState 形状変更なし) → opus 2-lens 敵対 review。

**DEFER (増分4 = 最後)**: P10 partnerSolveOverride (per-game【事件解決】書換 + 【証拠隠滅】keyword +
cost「証拠を事件レベル数リムーブ」= Cost union) は T3 フル review + Playwright。B09107 consumer は card phase。
