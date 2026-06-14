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

## engine拡張 wave#2 cluster3 — action-lifecycle trigger 族 (2026-06-13、調査中)

- 機械再集計 (`.tmp/cluster3-recount.cjs` → `.tmp/cluster3-pending-yellow.json`): 残 yellow 109 sig/146枚。
  有力候補 4 つのうち name-designation / multi-card sceneEnter は wave#1 DEFER の複合ゲート (FILE-zone verb 等) と重複 → 見送り
- **cluster3 選定 = action-lifecycle trigger 族 14 sig/16枚** (action-subtype 8 + evidence-gain-by-action 4 + action:end 4。
  同一機構: アクションのライフサイクル hook + matcher/payload/duration)
- TSV 16/16 抽出済 (`.tmp/cluster3-action-triggers/_raw_cards.md`、qAndA 一次根拠付き)。
  B08012P / PR092 は gameplay 列 byte 一致 → spread 再録方式
- 事前 grep: action:declare trigger は出荷済 19 ファイル (D03007 selfOnly 型 / B02014 charGrantAbility 付与)。
  action:end / evidence:gain は hook 定義済・カード使用 0 = 露出/payload 整備が本クラスタの主ギャップ
- 調査 Workflow 7 lens (115万tok) → 敵対レビュー 3 lens (73万tok、approve-with-fixes×3・major 7 全反映) →
  **設計 v2 確定** = `.claude/specs/engine-wave2-action-triggers-design.md`

### cluster3 実装完了 (2026-06-14、検証全 green)

- **engine X9-X16**: X9 evidence:gain emit+refresh / X10 TRIGGERED_HOOKS +action:end/evidence:gain /
  X11 triggerActionKind cond / X12 scope:'action' read+filter 4サイト / X13 targetUid payload /
  X14 CPU declare-drain (BUG-141) / X15 evidenceGain refresh (BUG-142) / X16 contact driver optional/choice pause gate
- **カード 15枚出荷** (ALL_CARDS 1140→1152): a群7 b群4 c群4。B08012P/PR092 spread 再録。DEFER B06049
- **検証全 green**: TDD pin 25 + 構造テスト 15 + 実カード挙動テスト 10 (decoy 込) / opus 突合 15/15 equivalent /
  tsc 0 / validate-specs 70-0 / full vitest **2074** / smoke baseline **byte 一致** (X14/X15 は現 smoke デッキに影響せず) /
  e2e 119 / MCP 実機 app 起動+対戦開始 console error 0 (favicon 404 のみ)
- **記録済**: BUG-141/142 修正済・143/144 繰越起票 / rules/22 R1+R4 改稿+R2/R5 追記・rules/25 R3 追記 /
  DEFERRED-INDEX cluster3 節 / changelog-entries/2026-06-14-01
- **残**: docs:changelog → npm run docs → pre-commit → commit → main ff-merge → push → CI
- 出荷 15 / DEFER 1 (B06049=ヒラメキ抑止ゲート)。engine 変更 X9〜X15 (詳細は設計 doc)
- **決定論検証の追加 finding** (レビュー待ち中に確定):
  - GAP-D5 実在確認: clearTurnEffects に 'contact' scope 無し (mutate/char.ts:132)、apMod_contact は
    turn 終了でのみ削除 → 同一ターン2コンタクト目に stale (rules/08 §6 違反) → **BUG-143 起票予定 (fix は cluster3 外)**
  - X14 回帰: smoke デッキ内 action:declare 持ち = D08021 (draw/evidenceGain) + D11015 (AP+1000 pick)。
    smoke は seed 固定の決定論 → drain 順序変更で guard 判断入力が変わり **baseline 変動ほぼ確実** (公式裁定準拠の修正)
  - X15 回帰: evidenceGain 使用出荷 13 枚に smoke デッキ D08013/D08021/D11003 含む → deck0 経路で baseline 変動可能性
  - **実装は段階別 smoke で帰属分離**: X9-X13 (inert、一致確認) → X14 → X15 → カード登録 (各段で smoke 実行、
    変動は BUG-141/142 に帰属記録、最後に baseline 更新 1 回)
