# 次セッション再開プロンプト (2026-06-12 リファクタ Phase 2c 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
**作業順 (ユーザー承認済): ③ カード wave#2 → ④ リファクタ Phase 3〜4**

> モデル方針 (2026-06-12 確定): カード wave = `/model opus`、リファクタ系 = `/model fable`。
> subagent は CLAUDE.md「トークン運用ルール」参照。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/refactor-plan/INDEX.md を読んで状況を把握すること。

## 現在地 (2026-06-12 セッション末)

- リファクタ Phase 0/1a/1b/1c/2a/2b/2c 完了・main へ push 済。残りは (wave#2 後) 3a〜4。
- Phase 2c で dispatch 契約が変更済: declaredAbility/partnerAbility は
  {type, uid, abilId, costParams?} のみ渡す (cost+ctx の caller 構築は廃止。
  engine.flow.activateDeclaredAbility / activatePartnerAbility が構築+pay を一元実施)。
  **wave#2 の e2e でも cost+ctx を手書きしないこと** (def に cost があれば自動で支払われる)。
- project skills: /card-wave (カード wave 手順) と /refactor-phase (リファクタ手順) 新設済。
  **該当作業ではまず対応 skill を呼ぶこと。**

## 今回やること: カード wave#2 (green候補刈り取り + engine拡張 wave#2)

/card-wave skill を呼び、その手順に従って実行する。スコープ:
- Task A green候補の残 ~260 枚 (certify 済 30/254 + 未着手分。
  infra: scripts/wf-certify.mjs + codegen/collect、.tmp/certify/ に 325 結果)
- engine拡張 wave#2: .claude/specs/task-d-priority-map.json の次ゲート群
  (mustGuard / auraGrant (B09024) は Task D wave#1 から DEFER 済)
- 状態 doc: .claude/specs/DEFERRED-INDEX.md / project-taskA-greencand-wave メモリ参照

完了後は phase-commit hook の指示どおり本ファイルを「Phase 3a 開始」用に更新し、
/clear 推奨でターンを終えること。

最初に何をすべきかを宣言してから着手してください。
```
