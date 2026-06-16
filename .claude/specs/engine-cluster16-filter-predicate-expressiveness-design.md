# engine cluster16 — filter-predicate 表現力完成 (card-name EXCLUSION + deckReveal cross-field OR)

> 骨格凍結例外 (engine 拡張)。全 additive。cluster15 (removal-observer) の follow-up。
> Phase 0 決定論検証で確定: 3 候補 gate (cutin-subtype/grant-textual/dynamic-count) は全て過剰
> グルーピング。action-active-enemy は `actionTargetsActive` で既実装。最低リスク・完全 additive・
> 単一サブシステムの真 gap = filter-predicate 表現力 (negation + cross-field OR)。

## §1 gap と根拠 (grounding 済)

| gap | 現状 | 該当カード (他句も green な ship 候補) |
|---|---|---|
| **G1 card-name EXCLUSION** | `TargetFilter.cardName` は positive-membership のみ (candidates.ts matchOneFilter L256-262 / targetFilterToPredicate L100-104)。「カード名X以外」が表現不能 | B06087/PR280 (cluster15 trigger green化済・唯一の blocker が exclusion)・B03053・B06081・B09016 |
| **G2 deckReveal cross-field OR** | `deckRevealUntil` は `a.filter` 単一 TargetFilter を `targetFilterToPredicate` に渡すのみ。`filterAny` (OR-of-filters) は型・candidates.ts では honored だが **reveal path で未読** | B03016 (tier1)・B04012・B07035 |

DEFER (exclusion/OR 以外の gap も持つ): B01047 (grant-textual+self-bounce)・B03113 (現場リムーブ時 summon)・B05042 (event-use closure)・B06008 (下に重ね identity)。→ exclusion を足しても他 gate で yellow 継続。

## §2 engine 変更 (全 additive)

### G1 `cardNameNot` 新フィールド
1. `src/engine/types/effect.ts` TargetFilter に `cardNameNot?: string | string[]` 追加。
2. `src/engine/target/candidates.ts` matchOneFilter: `cardNameNot` 定義時、name-components (rules/19 split-name、`allCardNameComponentsForDef`) の **いずれかが** wants に含まれたら **除外** (positive cardName と対称)。
3. `src/engine/effect/atom-handlers.ts` targetFilterToPredicate: 同ロジック (BUG-118/cluster2 前例 — 両 predicate 経路 sync)。
4. `tests/.../sync-taskA-whitelists.test.ts` L30 literal に `cardNameNot: true` (`satisfies` が typecheck guard)。
5. `scripts/taskA-validate-specs.cjs` FILTER_FIELDS に `'cardNameNot'`。

→ cond/eval.ts sceneHas は matchOneFilter 経由 (L320) なので **B09016 の condition 名前除外も自動 honored** (追加配線不要)。

### G2 deckRevealUntil `filterAny` (OR predicate)
6. `src/engine/effect/atom-handlers.ts` deckRevealUntil: `a.filterAny` (TargetFilter[]) 存在時、predicate を `(id) => a.filterAny.some(f => targetFilterToPredicate(f)(id))` で構築。単一構築点なので human-pick 再 filter (matchCands.filter) も自動整合。`a.filter` と `a.filterAny` 併存時は filterAny 優先 (certify 側で排他生成)。filterAny は validate-specs L105 で既に検証・型既存 → 型/whitelist 変更不要。

## §3 ルール網羅 (rules/01〜26)

- rules/19 §複数名カード: 除外も split-name 全 component で判定 (positive と対称)。《江戸川コナン&工藤新一》は [工藤新一]除外で除外される。
- rules/15 §「〜枚まで」=0可: 除外で候補0なら「選ばない」も合法 (既存 nMin:0 path)。
- rules/12 §ネクストヒント色制限: G1/G2 は候補 filter のみ、色制限ロジックは不変。
- out of scope: 02/04/05/14/18/21 等 (filter 述語に無関係)。

## §4 エッジケース (最低5件)

1. **候補0**: cardNameNot 除外で pick 候補が0 → 既存「対象なし」path (rules/15)。
2. **split-name 除外**: [江戸川コナン]除外が《江戸川コナン&工藤新一》に効く (rules/19 対称)。
3. **deck N枚未満で filterAny**: maxN > deck.length → 既存 `Math.min(deck.length, maxN)` で安全。reveal-until で match 無し → 全公開後 matched=null (rules/26)。
4. **cardName + cardNameNot 併用**: positive 一致 AND 除外不一致 (両条件 AND、稀だが矛盾時 候補0)。
5. **deck 0枚で deckRevealUntil**: 既存 path (revealed=[], matched=null)。リフレッシュは呼び出し側責務 (本変更は filter のみ、不変)。
6. **filterAny に cardNameNot 混在**: filterAny[i] も matchOneFilter/targetFilterToPredicate 経由なので cardNameNot 自動 honored。

## §5 水平展開

- 同型 filter 経路は **3つ**: matchOneFilter (candidates.ts、全 area pick の正準) / targetFilterToPredicate (deckRevealUntil) / cond/eval.ts (matchOneFilter 委譲)。G1 は matchOneFilter+targetFilterToPredicate の2点に書けば全経路カバー (cond は委譲)。
- BUG-117/118/cluster2 の教訓 = 「2 predicate 経路の silent drift」。本変更も両経路に同時実装し unit test で byte 検証。
- positive cardName が既に両経路で sync 済なのを確認済 (L100-104 / L256-262)。

## §6 状態完備性

- GameState 変更なし (filter は述語のみ、state mutation 無し)。
- UI 影響: 候補列挙 (EffectPickerModal) は matchOneFilter 経由なので cardNameNot 除外後の候補が自動反映。新 UI 要素なし。

## §7 検証計画

- unit: `cardNameNot` を matchOneFilter / targetFilterToPredicate / cond sceneHas の3経路で +/- test。`filterAny` を deckRevealUntil の OR で +/- test。split-name 除外。
- gate5 実機: ship カードで decoy (除外対象名のキャラを盤面/手札) を置き、候補から除外されるのを playwright MCP で1対1確認。
- 全 gate: validate-specs (engine変更0 ではないが新 field 登録後 pass) / tsc / vitest baseline / smoke baseline 不変 (filter 述語追加は既存カード挙動不変 = baseline byte 同一が証跡) / playwright / lint:*。

## §8 確定設計 v2 (opus 3-lens 敵対設計レビュー反映、whiudba3c)

レビュー全 lens = APPROVE_WITH_CHANGES。BLOCKER 2 + MAJOR 4 を反映:

### 修正1 (BLOCKER, Lens A): filter 評価経路は **3つ** (spec v1 の「2点」は不足)
filter:TargetFilter を消費する経路 = ① matchOneFilter (candidates.ts、全 area pick 正準) ② targetFilterToPredicate
(atom-handlers.ts、deckReveal) ③ **boundMatchesFilter (cond/eval.ts L246-290、bound カードの filter 照合)**。
③は matchOneFilter 非委譲の inline 再実装で、コメント自身が「targetFilterToPredicate と並ぶ第3の drop サイト」と
記録 (cluster2)。**cardNameNot を3経路全てに配線**(L262 cardName ブロック直後)。bond(L82)/removeNameAtLeast(L198) は
bare cardName scalar で filter 非経由 → cardNameNot 対象外 (混入不能)。

### 修正2 (MAJOR, Lens A+B): framing 訂正 — capability unlock でなく **JSON化/closure排除**
除外は `filter.custom` closure で**今日実装可能** (B09017 が `[吉田歩美]以外` を出荷済、48枚が allCardNameComponentsForDef
closure 使用)。B06087 は既に green (custom, needsManual)。cardNameNot の価値 = **closure→declarative 化で pure-JSON
codegen 可能 + closure drift 排除 (DSL-first 運用整合)**。excludeSelf(uid) は同名2枚目を誤許容するので name 単位除外が
正しい primitive。骨格凍結例外の正当化 = 「positive cardName の対称完成 + DSL-first/JSON化」(BUG-118 kind 昇格・cluster2
keyword/cardName sync と同型の filter 表現力完成)。

### 修正3 (MAJOR, Lens A+B): ship/DEFER 再分類
- **B03113 → G1 ship 候補に昇格**: certify の唯一 blocker は exclusion。現場リムーブ時 summon は B04007 で出荷済、
  keyword:'カットイン' filter は defHasKeyword 対応済。
- **B06087**: 既 green (custom)。cardNameNot で custom→declarative 置換 (新規解禁でなく JSON化)。
- **B01047 DEFER 維持** だが理由訂正 = grant-textual でなく **action-end self→デッキ下 bounce の trigger 未検証**
  (grant-textual は B02014/charGrantAbility で表現可)。
- B03113/B05042/B06008 の DEFER は他 gate (B05042=event-use closure / B06008=scene→stack identity) で妥当。

### 修正4 (BLOCKER, Lens C): 未certify カードは ship 前に certify 必須 (skill §2)
**B03053/B06081/B09016 は未certify** + 非exclusion 機構を持つ → certify 必須。特に **B09016「ミスリードしたとき」反応
trigger が TRIGGERED_HOOKS 未配線の疑い** → yellow なら DEFER。**B07035 は landscape black-bucket/partner-area 誤分類** +
解決編 conditional discard 残句 → 再 certify。ship は **certify GREEN を確認した枚数のみ**。

### 修正5 (MINOR, Lens C): G2 意味論を candidates.ts に統一
deckRevealUntil の filter+filterAny 併存は **AND-of(filter, OR(filterAny))** (candidates.ts matchesFilters L236-243 と
同一)。spec v1 の「filterAny 優先(排他)」は drift 温床なので撤回。ship 3枚は併存しないので実害なしだが意味論統一が安全。
filterAny[i].cardNameNot も targetFilterToPredicate 経由で honor。

### 確定 touched files (commit 1 = engine、ship 0)
1. `src/engine/types/effect.ts` — TargetFilter += `cardNameNot?: string|string[]`
2. `src/engine/target/candidates.ts` — matchOneFilter cardName ブロック直後に cardNameNot
3. `src/engine/effect/atom-handlers.ts` — (a) targetFilterToPredicate cardName 直後に cardNameNot (b) deckRevealUntil で a.filterAny を AND-of(filter,OR) predicate 構築
4. `src/engine/cond/eval.ts` — boundMatchesFilter cardName ブロック直後に cardNameNot
5. `tests/engine/sync-taskA-whitelists.test.ts` L30 literal += `cardNameNot: true` (satisfies guard)
6. `scripts/taskA-validate-specs.cjs` FILTER_FIELDS += `'cardNameNot'`
7. 新規 unit test — cardNameNot×3経路 + sceneHas(candidates委譲) + filterAny-OR(deckReveal) + split-name 除外 + filterAny[i].cardNameNot

### ship 計画 (commit 2 = certify→出荷、別コミット推奨 Lens C)
certify (opus): PR280/B03016/B04012/B07035/B03113/B03053/B06081/B09016 + B06087 (custom→declarative 変換)。
GREEN のみ pure-JSON codegen で出荷。smoke baseline は additive で不変 (avgTurns/timeouts/exceptions check、byte ではない)。
