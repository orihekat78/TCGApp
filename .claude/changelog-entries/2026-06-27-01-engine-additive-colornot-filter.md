# engine — additive wave: TargetFilter `colorNot` (2026-06-27)

**Round/Phase**: 2026-06-27 engine additive wave。骨格凍結原則の **additive 例外** で
色 NEGATION filter (「【X】以外の色を持つ」) の正準 declarative 形を追加。cluster16 `cardNameNot` の
color 版。全変更 additive (既存カードは新 field 未宣言 → 回帰0、smoke winsA=498 不変)。
spec: `.claude/specs/engine-additive-colornot-filter-design.md`。

## 新 TargetFilter field `colorNot`

- 〚【X】以外の色を持つキャラ〛(キャラ TargetFilter / sceneHas 条件) を表現する `colorNot?: string | string[]`。
- **semantics は公式 B08079 ピンガ qa で確定 (some説)**: 「X以外の色を1つ以上持つ」
  (= `colors.some(c => c∉notSet)`)。mono-X 除外 / 2色{X,Y} 該当 (Y を持つ) / mono-Y 該当。
  等価: 全色が notSet 内のとき除外。⚠ `cardNameNot` (any-match 除外) とは **2色で非対称**。

## honor site (filter-predicate 4 点、`cardNameNot` を mirror)

- 型 (`types/effect.ts`) / `matchOneFilter` (`target/candidates.ts`: target pick・sceneHas cond・auraDelta 再入) /
  `boundMatchesFilter` (`cond/eval.ts`: bound card inline eval) /
  `targetFilterToPredicate` (`effect/atom-handlers/_shared.ts`: deckRevealUntil path)。
- 他の TargetFilter consumer (fileTopMatches/triggerCharMatches/removedCharMatches/enterSource/auraFilter/
  deckReveal) は全て matchOneFilter / predicate へ委譲 → 自動 honored (敵対 review completeness lens で確認)。

## 検証

- TDD (RED→GREEN)。新 test `tests/cards/engine-colornot-filter-2026-06-27.test.ts` 13 pass
  (3 eval site × {mono除外/mono該当/2色該当(公式)/array} + additivity + color AND + 色なし edge)。
- gate: tsc0 / smoke:1000 winsA=498 不変 ex=0 / full vitest 3105 pass 0 fail / 8 lint + eslint 0。
- **opus 5-lens 敵対 review = ship:true / blocker 0** (additivity/completeness/semantics/edge 全 CLEAN、
  test concern 1 は array@§3・AND@§2・色なし edge を予防テスト追加で解消)。

## 副産物: BUG-159 起票

- 設計 grounding 中、出荷済 **B02010 (灰原哀)** が同一文言「【青】以外の色を持つ」を custom closure
  `!colors.includes('青')` = **none説**で実装し、2色対象を公式違反で誤除外していることを発見
  (敵対 review edge lens も独立確認)。BUG-159 起票。migration (colorNot 採用) は別 card-session。
- 水平展開 audit: shipped「以外の色を持つ」は B02010(none説 bug) / B08090(complement-enum some説 正) の
  2手法。colorNot が唯一の公式準拠 declarative 形を与え、両者を統一可能。

## 解禁カード (card-session 領分、別途 certify)

- B02002 / B07012 / B08081 / B08082 / B08090 / B08091 等の「【X】以外の色を持つキャラ」filter 句
  (engine0 で colorNot 採用可。各カードは他句の gate も要確認)。
