# 作業ログ — 名探偵コナンTCG プロジェクト

> cluster2 までの詳細は sessions/2026-06-13.md + changelog-entries/2026-06-13-01 参照。

## 現在地 (2026-06-13)

### engine拡張 wave#2 cluster2 — ability-presence filter ✅ (branch engine/wave2-ability-filter、commit 前)

- engine: X1 (現リム時/疾風 述語) / X1b (filter drop 2サイト解消+FILTER_FIELDS sync test) /
  X6 boundToRemove / X7 mill refresh (BUG-137) / X8 drain 所有権+humanPick pause (BUG-138) /
  BUG-139 endTurn gate / BUG-140 起票+B04096/P 補修
- カード 10枚出荷: B03131/B03128/B08005/P/B08016/B08094/P/B09104/B09073/P (ALL_CARDS→1140)
- 全ゲート green (vitest 2016 / smoke baseline 完全一致 / e2e 119 / MCP decoy 3 / console err 0)
- DEFER: B08078/P・B08082・B03133・B06020・B07098/P・B07102 (DEFERRED-INDEX) + BUG-140 残74枚

### BUG-140 補修 wave ✅ (branch fix/bug-140-icon-abilities、2026-06-13)

- 決定論パッチ `scripts/fix-bug140-icon-abilities.mts` で 76 行一括補修: 直接 52 ファイル
  (7 テンプレ正準形) + spread 継承 22 (TSV 一致機械検証) + DEFER 2 (B05039/B06035)
- `npm run lint:icon-abilities` 新設 (allowlist+stale 検知) → pre-commit + CI 規約 8 本目
- 挙動テスト 8 件新設 (hirameki 4 テンプレ実 fire 経路 decoy 付 / cutin 3 テンプレ実 contact 経路)
- 全ゲート green: tsc / vitest 2024 / smoke baseline 完全一致 / e2e 119 / lint 8 本

## ポインタ

- 設計: `.claude/specs/engine-wave2-ability-filter-design.md` (v2)
- 調査/レビュー: `.tmp/wave2-ability-filter/*.md`
- bug: BUG-137〜140 (全件修正済。140 は DEFER 2 枚を DEFERRED-INDEX に繰越)
