# 作業ログ — 名探偵コナンTCG プロジェクト

## 2026-05-21 セッション 10 (BUG-037 CSS animation fill-mode 修正)

- user_request #1 / #16 (重複): scene card が sleep にならない
- 原因: `SceneArea.css:128` `animation: scene-card-enter ... both;` の `forwards` 側が transform を lock
- 修正: fill-mode `both` → `backwards` の 1 行
- 検証: typecheck / 1511 unit / 38+1 E2E / 1000-game smoke 0 errors
- 新規 spec: `tests/e2e/bug-037.spec.ts` (sleep + stun computed transform を assert)
- セッション詳細: `.claude/sessions/2026-05-21-10.md`
- commit: `9567c0c` (BUG-037 修正) / `cdaa5f7` (hash 反映)

## 2026-05-21 セッション 11 (Phase α — user_request triage)

- plan 作成: `C:\Users\arumi\.claude\plans\shimmying-dancing-hippo.md`
- 公式 PDF p.12-13 を WebFetch + Read で直接確認:
  - #5 解決編移行は **必ず移行 (移行させないことはできません)** ← 仕様通り
  - #6/#14 NH は **権利が増え、後で使えるわけではありません** ← 仕様通り
- Phase α 4 件:
  - `.claude/CLAUDE.md` — 「効率より精度」方針追加 (#2)
  - `.claude/docs/user-request-clarifications.md` 新規 (#5/#6/#14)
  - `.claude/specs/DEFERRED-INDEX.md` 新規 (#11)
  - `.claude/bugs/README.md` 新規 (#10)
- 関連 memory: `feedback_accuracy_over_speed`, `feedback_rule_rebuttal_pattern`

## 2026-05-22 セッション 12 (Phase β #7 #15 — BUG-038 close + BUG-040 fix)

- BUG-038 (#7 sleep target): Playwright headed で再現せず → 仕様外 close (BUG-037 で間接解決) `152253d`
- BUG-040 (#15 declared ability): `Playmat.tsx:382` で `declaredTargetCount={0}` ハードコーディング → メニュー常時 disabled
  - 修正: `enumDeclaredAbilitySources(state, 'self').length` を計算
  - Playwright headed: source picker → ability auto-select → 発動 → sleepSelf cost paid + log に declaredAbility 記録
  - unit 1511 + E2E 40 PASS
