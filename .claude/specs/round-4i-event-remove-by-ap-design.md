---
name: round-4i-event-remove-by-ap-design
date: 2026-05-20
round: 4i
status: design
related:
  - .claude/specs/shared-classes/eventRemoveByAP.md
  - .claude/specs/cards-analysis/D08025.md
  - .claude/specs/cards-analysis/D11020.md
  - tests/e2e/patterns/case-trait-conditioned.spec.ts
---

# Round 4i — eventRemoveByAP E2E spec 設計

## 対象カード
- **D08025 (蘭の一撃 / 青 / Lv5)**: shared factory `eventRemoveByAP({ apMax:8000, additionalCondition:{ kind:'partnerColor', color:'青' } })`
- **D11020 (18の想起 / 黄 / Lv8, MVP 外)**: 個別 sequence
  - step1: choice / sceneRemove (filter.levelMax:7 / state:['sleep'])
  - step2: conditional (`removeTraitAtLeast 神奈川県警 ≥3`) → choice / sceneRemove (filter.apMax:8000)

両者とも `effect:declared` + `{ kind: 'event-use', cardId }` payload で発動。

## ファイル
- 新規: `tests/e2e/patterns/event-remove-by-ap.spec.ts` (≤180 LOC 目標)
- 流用: `tests/e2e/helpers/index.ts` (`setupGamePage`, `buildGameState`, `dispatchAction`, `getGameState`, `expectNoConsoleErrors`)

## 検証レイヤー (共通)
1. `cardDef.abilities[0]` 存在 + `trigger.hook === 'effect:declared'`
2. matcher: `{ kind: 'event-use' }` → true / `{ kind: 'character-use' }` → false (negative matcher)
3. dispatch `handUseCard(cardId)` 経由 → `pendingEffects` に該当 effect が queue
4. console error 0

## 個別レイヤー
- **D08025**: `condition === { kind: 'partnerColor', color: '青' }`、effect.kind === 'choice'、内部 sceneRemove.target.query.filter.apMax === 8000
- **D11020**: effect.kind === 'sequence'、steps[0] choice (filter.levelMax === 7 / state ⊇ ['sleep'])、steps[1] conditional + inner `removeTraitAtLeast 神奈川県警 ≥3`

## engine gap 探査 (見つけたら BUG 登録、fix は次 round)
- **gap-1**: `eventRemoveByAP` factory が `trigger.selfOnly` 未設定 → 相手手札の同 hook が誤発動の可能性。dispatch 後 `pendingEffects` を scan して opp 側 source が混入していないか確認。
- **gap-2**: `ability.condition` (partnerColor) が listener layer (`triggered.ts handleHook`) で未評価。partner=非青 状態でも pendingEffects に積まれる可能性。
- **gap-3**: condition は resolve 段で評価される設計の場合、その経路の test を別途追加 (Round 4i では out-of-scope、4j+ で検討)。

発見時の対応:
- `.claude/bugs/BUG-032.md` (selfOnly gap)
- `.claude/bugs/BUG-033.md` (condition layering)
- spec 側は engine の **現状動作** を verify (test 自体は green、gap は detect & document のみ)

## state fixture
- `self.case.cardId = 'D08026'` (青色)、`self.case.colors = ['青']` (D08025 の色 gate 通過用)
- `self.partner.colors = ['青']` (D08025 partnerColor 条件)
- `self.file.length ≥ 8` (D11020 lv8 用)
- `self.hand = ['D08025' | 'D11020']`
- `self.scene` に最低 1 体 (effect queue 検証は dispatch 後 pendingEffects 確認、scene char は console error 回避のため)
- `self.remove` に 神奈川県警 trait 持ち 3 枚 (D11020 step2 gate)

## エッジケース
1. **両方の手札に D08025 がある場合**: gap-1 検証経路
2. **partner=赤 で D08025 dispatch**: gap-2 検証経路 (condition 未評価なら pendingEffects に積まれる)
3. **self.remove に 神奈川県警 0 枚で D11020 dispatch**: step2 conditional → false → step1 のみ queue
4. **file.length < 5 で D08025 dispatch**: `canHandUseCard` で reject → throw → matcher 不発火
5. **case.colors=['赤'] (青なし)**: 色制限で `canHandUseCard` reject

## 完了条件
1. typecheck clean
2. unit 1464+ pass (回帰なし)
3. E2E 19 → 23 pass (新規 4 = 各カード 2 = positive 1 + negative-matcher 1)
4. docs:check clean
5. smoke 525/475 baseline 維持

## commit
`test(e2e),docs(bugs): Round 4i — eventRemoveByAP 2 カード E2E + (gap 発見時) BUG-032/033 登録`

## 進捗影響
- 共通パターン spec: cutinFixedAP / partnerColorKeyword / caseTraitConditioned / **eventRemoveByAP** = **4/5** 完了
- 残: hiramekiDraw (Round 4j) / hiramekiCharStun (Round 4k)
