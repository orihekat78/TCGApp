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

## ポインタ

- 設計: `.claude/specs/engine-wave2-ability-filter-design.md` (v2)
- 調査/レビュー: `.tmp/wave2-ability-filter/*.md`
- bug: BUG-137〜140 (137/138/139 修正済、140 未着手・audit data 添付)
