# engine拡張 wave#2 cluster16 — filter-predicate 表現力完成 (card-name EXCLUSION + deckReveal cross-field OR)

**Round/Phase**: 2026-06-16 engine拡張 wave#2 cluster16 (`engine/wave2-cluster16-filter-predicate`)。
ユーザー判断で「次の密 engine クラスタ」を選択。cutin-subtype の教訓に従い **sweep ラベルを信用せず実テキスト
決定論分類で homogeneity 検証** → prompt の 3 候補 gate (grant-textual 50 / dynamic-count 45 / cutin-subtype 69) は
**全て過剰グルーピング** (wrapper 共通だが中身異種) と実証、action-active-enemy は `actionTargetsActive` で既実装と判明。
evidence-based (certify 95件の blocker 集計) に最も低リスク・完全 additive・単一サブシステムの真 gap = **filter-predicate 表現力**。

## engine 変更 (骨格凍結例外 = scoped engine-extension、全 additive)

filter 述語の表現力を 2 軸で完成。既存カード挙動は一切不変 (smoke baseline winsA=498 byte 級不変が証跡)。

- **G1 `cardNameNot`** (新 TargetFilter フィールド): 「〚カード名[X]〛以外」を declarative 化。positive `cardName` と対称
  (rules/19 split-name の component いずれか一致で **除外**)。`excludeSelf`(uid 単位) と異なり name 単位除外なので同名2枚目も除外。
  honor 経路 = **3つの filter-eval サイト**: `matchOneFilter` (candidates.ts、全 area pick 正準 + sceneHas 委譲) /
  `targetFilterToPredicate` (atom-handlers.ts、deckReveal) / `boundMatchesFilter` (cond/eval.ts、第4の inline サイト)。
- **G2 deckReveal cross-field OR**: `deckRevealUntil` が既存 `filterAny` (OR-of-filters) を reveal-filter 経路でも honor
  (従来は candidates.ts のみ)。意味論は candidates.ts matchesFilters と同一の **AND-of(filter, OR(filterAny))**。
- **5点 sync**: TargetFilter 型 + sync-taskA-whitelists.test.ts literal (satisfies guard) + validate-specs FILTER_FIELDS +
  matchOneFilter + targetFilterToPredicate (+ boundMatchesFilter)。

## 実装前 opus 3-lens 敵対設計レビュー (BLOCKER 2 + MAJOR 4 を捕捉、whiudba3c)

`.claude/specs/engine-cluster16-filter-predicate-expressiveness-design.md` §8 = v2 確定設計。

1. **BLOCKER**: `boundMatchesFilter` は matchOneFilter 非委譲の **第4の inline filter-eval サイト** (コメント自身が「第3の
   drop サイト」と記録、cluster2)。spec v1 の「2点で十分」は不足 → cardNameNot を3経路全てに配線 (BUG-117/118/cluster2 drift 防止)。
2. **MAJOR (framing)**: 除外は `filter.custom` closure で**今日実装可能** (B09017 が同型出荷済、48枚使用)。cardNameNot は
   **capability unlock でなく closure→declarative 化 (pure-JSON codegen 可能 + closure drift 排除)** = DSL-first 運用整合。
3. **MAJOR (再分類)**: B03113 は過剰DEFER (唯一 blocker が exclusion、現場リムーブ時 summon は B04007 で出荷済) → ship 候補昇格。
4. **MINOR**: G2 意味論を「filterAny 優先」から candidates.ts と同一の AND-of(filter,OR) に統一 (drift 防止)。

## 検証 (全 green、engine commit = ship 0)

- engine unit test (`tests/engine/filter/cluster16-filter-predicate.test.ts`) **14 pass**: cardNameNot×3経路 (matchOneFilter /
  boundMatchesFilter / deckRevealUntil) + split-name 除外 (rules/19) + cardName+cardNameNot AND + additive 安全 (未指定 skip) +
  filterAny OR (cross-field) + filterAny[i].cardNameNot + AND-of(filter,OR) 意味論。
- tsc 0 / sync-whitelists pass (3点同期) / **full vitest 2588 pass 0 fail** (+14、既存減なし) /
  **smoke baseline winsA=498 不変・timeouts=0・exceptions=0** (additive 完全証跡) / lint:* 8本 errors=0 / validate-specs pass=60 fail=0。

## 出荷予定 (別コミット、certify GREEN のみ)

certify (opus) → pure-JSON codegen 出荷: PR280 (cardName除外) / B03016・B04012・B07035 (cross-field OR) / B03113 (cardName除外、
他句 grounded) / B06087 (custom→declarative 変換) / B03053・B06081・B09016 (未certify、要全句確認、B09016 はミスリード反応 hook 疑い)。
