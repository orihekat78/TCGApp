# 次セッション再開プロンプト (2026-06-12 Phase 2b + トークン運用整備 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
**作業順 (ユーザー承認済): ② リファクタ Phase 2c → ③ カード wave#2 → ④ リファクタ Phase 3〜4**

> モデル方針 (2026-06-12 確定): リファクタ系セッション = `/model fable`、
> 通常作業 (カード wave 等) = `/model opus`。subagent は CLAUDE.md「トークン運用ルール」参照。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/refactor-plan/INDEX.md を読んで状況を把握すること。

## 現在地 (2026-06-12 セッション末)

- リファクタ Phase 0/1a/1b/1c/2a/2b 完了・main へ push 済。残りは 2c → (wave#2 後) 3a〜4。
- トークン運用ルール (CLAUDE.md 新節) / phase-commit hook (settings.json) /
  GitHub Actions CI (.github/workflows/ci.yml) / .mcp.json (Serena + firecrawl) 導入済。
- project skills 新設: /refactor-phase (リファクタ手順) と /card-wave (カード wave 手順)。
  **該当作業ではまず対応 skill を呼ぶこと。**
- Serena MCP は今セッションから有効のはず (初回起動は uvx 依存解決で遅い)。
  firecrawl は FIRECRAWL_API_KEY 未設定なら接続失敗するが他に影響なし。

## 今回やること: リファクタ Phase 2c (dispatch 契約是正)

/refactor-phase skill を呼び、その手順に従って実行する。スコープは
.claude/specs/refactor-plan/phases.md §2c:
- declaredAbility / partnerAbility の cost+ctx 構築を dispatcher 内 (or engine helper) に移し、
  呼出元 (UI/AI/e2e) は {type, uid, abilId, costParams?} のみ渡す (BUG-116 構造解消)
- effectPickResolve の optional 引数群を union 型で required/optional 明示
- 注意: cost picker の人間選択値 (flipFaceUpEvidence indices 等) は dispatcher 内で再現
  できないため costParams として action 引数に残す設計が必須。pay は produce 内 +
  ctx.costPaid/dyn の伝播 (BUG-085) を維持。AI 経路 (policy.ts) も同じ helper を共有させる。

完了後は phase-commit hook の指示どおり本ファイルを「wave#2 開始」用に更新し、
/clear 推奨でターンを終えること。

最初に何をすべきかを宣言してから着手してください。
```
