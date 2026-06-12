# 次セッション再開プロンプト (2026-06-12 Task D wave#1 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
**方針 (ユーザー承認済 2026-06-12): ① commit → ② リファクタ Phase 1c〜2c → ③ カード wave#2 → ④ リファクタ Phase 3〜4**

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/auto/structure.md → .claude/sessions/2026-06-12.md → .claude/specs/refactor-plan/INDEX.md
を読んで状況を把握すること。

## 現在地 (2026-06-12 セッション末)

- Task D engine拡張 wave#1 完了: E0(pick-bind)/E1(hand-count)/E2(sceneToDeck+cost)/E3(FILE-zone)/
  E4(textual-grant) + guard自己ガード除外 + charGrantKeyword短縮形。解禁カード35枚 (ALL_CARDS 1057)。
- リファクタ Phase 1a/1b も実行済 (mutate直書き5箇所是正 / dead side-channel除去、レビュー記録は
  refactor-plan/phases.md)。
- 全ゲート green: full vitest 1961 pass/0 fail / smoke:1000 baseline完全一致 / e2e 22+4+3 / lint 0 err。
- BUG-128/129/130 修正済・起票済。
- ⚠ **約195ファイル未コミット** (Task D 全成果 + 旧セッション残)。

## 作業順 (ユーザー承認済の優先順位)

1. **① commit (Phase 0)**: 未コミット分を整理して commit (main なので branch first)。
   - 推奨分割: (a) Task A 残骸 (changelog-entries 2026-06-09〜11 + smoke reports)、
     (b) Task D engine拡張 + テスト、(c) Task D カード35枚 + e2e、(d) リファクタ Phase 1a/1b、
     (e) specs/bugs/docs 類。`git add -A` 禁止 (明示 add)。pre-commit の docs:check が通る状態は確認済。
2. **② リファクタ Phase 1c〜2c** (.claude/specs/refactor-plan/phases.md の順、1フェーズ=1commit):
   - 1c: テスト fixture 統一 (makeChar/sceneChar/makeCtx 75定義 → tests/helpers/fixtures.ts 3本。
     旧スキーマ fixture 4ファイルは是正してから共通化)
   - 2a: PA短縮形 gate の共通 helper 化 (~7コピペ → 1、chooser 規約も一本化)
   - 2b: 手動同期ペアの機械検証化 (AtomVerb/Cost/HOOKS/CONDS の union ↔ Set ↔ cjs whitelist +
     pay.ts exhaustive check)
   - 2c: dispatch 契約是正 (declaredAbility の cost+ctx を dispatcher 内で構築 — BUG-116 構造対策)
   - 各フェーズ後: typecheck + full vitest + smoke baseline + e2e 回帰0 + 敵対レビュー (記録を phases.md へ)
3. **③ カード wave#2**:
   - (a) green候補の刈り取り残 (~260枚、certify 済リスト = .claude/specs/catalog-survey-2026-06-06/)
   - (b) engine 拡張 wave#2: task-d-priority-map.json の次ゲート群 (ability-presence filter 11 /
     action-subtype trigger 8 / cutin-subtype filter 7 / remove→deck-bottom verb 7 / 使用制限 7 / 等) +
     wave#1 DEFER (mustGuard / auraGrant / name-designation / multi-card sceneEnter / nested dyn /
     until-N discard — 一覧: DEFERRED-INDEX.md「Task D wave#1 繰越」)
   - 手法は wave#1 と同じ: grounding workflow → spec → TDD → authoring workflow (敵対検証、
     pick carrier は短縮形必須) → 全ゲート
4. **④ リファクタ Phase 3〜4** (高リスク群: atom-handlers 分割 / pick-resolution 再設計 /
   side-channel 縮減 / UI hooks 分割 / 周辺整理)。着手前に個別設計レビュー必須。

## 注意事項 (前回からの引き継ぎ)

- 骨格凍結原則: engine 拡張はユーザー承認済の Task D 系列のみ。additive 厳守
- pick carrier に明示 uid:'$pick'+target を使わない (human 経路で bind 喪失 — wave#1 で実証)
- 新 verb/cond 追加時は scripts/taskA-validate-specs.cjs の whitelist 同期を忘れない (2b で機械化予定)
- partner-area 構造 (B07045/B09047/MR能力①②) は wave#2 でも最終段 (GameState+UI 大規模)
- push は arumi 手動運用

最初に何をすべきかを宣言してから着手してください。
```
