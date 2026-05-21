# 作業ログ — 名探偵コナンTCG プロジェクト

## 2026-05-21 セッション 10 (BUG-037 CSS animation fill-mode 修正)

- user_request #1 / #16 (重複): scene card が sleep にならない
- 原因: `SceneArea.css:128` `animation: scene-card-enter ... both;` の `forwards` 側が transform を lock
- 修正: fill-mode `both` → `backwards` の 1 行
- 検証: typecheck / 1511 unit / 38+1 E2E / 1000-game smoke 0 errors
- 新規 spec: `tests/e2e/bug-037.spec.ts` (sleep + stun computed transform を assert)
- セッション詳細: `.claude/sessions/2026-05-21-10.md`
- commit: `9567c0c`
