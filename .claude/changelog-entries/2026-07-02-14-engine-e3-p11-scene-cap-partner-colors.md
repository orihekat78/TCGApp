### engine E3 増分2 — P11: sceneCapOverride + partnerColorsOverride (case ルール改変)

Track A1 structural、E3 増分2。case card 継続能力で 2 つの盤面ルールを per-game 改変する機構
(PR067 探偵の目「自分のパートナーの色は【青】…【黒】になる／自分の現場に置けるキャラの枚数は〚最大4枚まで〛になる」)。
engine-only (consumer PR067 は card phase / card 凍結中)。**挙動不変** (既存 case は未宣言 → default)。

- **`sceneCapOverride?: number`** ContinuousModifier field + **新 read helper [read/scene-cap.ts](../../src/engine/read/scene-cap.ts) `sceneCap(s,p)`**
  (case def の abilities[].continuousModifier.sceneCapOverride を走査、type==='continuous' + ability.condition honor、
  wave-5 handUseCharRestrictAllows 同流儀、既定 5)。**現場登場ゲート 6 サイトを集約** → `>= sceneCap(s,p)`:
  [mutate/scene.ts](../../src/engine/mutate/scene.ts) enter throw / [atom-handlers/scene.ts](../../src/engine/effect/atom-handlers/scene.ts) ×3 (multi-enter full / switch 早期分岐 / single switch) /
  [hand-use-card.ts](../../src/engine/flow/main/hand-use-card.ts) canHandUseCard/Switch ×2 / [ui/Playmat.tsx](../../src/ui/components/Playmat.tsx) switch-picker trigger + multi-enter overflow room 計算 (計7サイト)。
  ⚠ **絶対 invariant [sceneAtMost5](../../src/engine/invariant/sceneAtMost5.ts) は 5 のまま** — override は登場閾値のみ変更、既存 5 枚 + cap4 でも
  強制リムーブしない (rules/19 §下限なし 準拠の非強制解釈、公式は 5→4 超過時裁定を明示せず)。骨格凍結原則: ハードコード集約は動作不変内部最適化。
- **`partnerColorsOverride?: string[]`** ContinuousModifier field + [cond/eval.ts](../../src/engine/cond/eval.ts) partnerColor cond が honor
  (module-local helper、read/ 切り出しは read→cond/eval 逆依存循環ゆえ inline)。【パートナー(色)】評価を印字色の**代わりに**
  override 色集合で行う (PR067 全6色化 → 任意色成立)。不在時 印字色 (baseline 不変)。
  latent (frozen card では不発、敵対 review 2 lens 指摘): (i) candidates.ts partner-as-color-filtered-target 未 honor (【パートナー(色)】は partnerColor cond 経由で被覆) /
  (ii) override ability の condition に partnerColor を使うと無限再帰 / (iii) condition が ctx.bindings 依存 kind だと caseCtx.bindings={} で undefined。
  consumer 拡張時 guard 検討 (card-def.ts field コメント参照)。

**gates**: tsc 0 / vitest **3738 pass +1 skip** (base 3729 + 新規 9、regression 0) /
smoke:1000 **winsA=498 不変** exceptions=0 (override 宣言カード 0 = 全経路 default 5/印字色 = 挙動不変を実証) / 8 lint errors=0。
probe = [tests/cards/e3-p11-scene-cap.test.ts](../../tests/cards/e3-p11-scene-cap.test.ts) (sceneCap §1-6: 既定/override/登場ゲート/hand-use/condition-gate/invariant絶対5、partnerColors ×3: 印字のみ/全6色/condition-false)。

DEFER (E3 残): P53 (evidence-all-flip + evidenceTraitAtLeast + canWin 事件解決不可 flag、opponentLoses consumer) /
P10 partner【事件解決】override (最難 T3、partnerSolveOverride + canWin/solveCase/UI/AI 分岐 + 【証拠隠滅】keyword + cost)。分解 spec = [specs/e3-altwin-decomposition-2026-07-02.md](../../specs/e3-altwin-decomposition-2026-07-02.md)。
